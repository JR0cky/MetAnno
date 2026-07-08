import json
import sys
from pathlib import Path
from collections import Counter
import numpy as np

# Try to import torch, transformers, and scipy
try:
    import torch
    from transformers import AutoTokenizer, AutoModel
    from scipy.spatial.distance import pdist
    from scipy.cluster.hierarchy import linkage, fcluster
except ImportError as e:
    print(f"Error: Required library missing: {e}")
    print("Please install them by running:")
    print("  ./backend/.venv/bin/pip install torch transformers scipy")
    sys.exit(1)

def mean_pooling(model_output, attention_mask):
    """
    Mean pooling helper to generate sentence/phrase embeddings
    """
    token_embeddings = model_output[0]
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)

def get_embeddings(phrases, tokenizer, model):
    """
    Computes phrase embeddings in batches using PyTorch
    """
    batch_size = 64
    all_embeddings = []
    
    for i in range(0, len(phrases), batch_size):
        batch = phrases[i:i+batch_size]
        encoded_input = tokenizer(batch, padding=True, truncation=True, return_tensors='pt')
        with torch.no_grad():
            model_output = model(**encoded_input)
        sentence_embeddings = mean_pooling(model_output, encoded_input['attention_mask'])
        all_embeddings.append(sentence_embeddings)
        
    return torch.cat(all_embeddings, dim=0)

def hierarchical_clustering(embeddings_np, threshold=0.35):
    """
    Performs Hierarchical Agglomerative Clustering using Cosine Distance
    """
    dist_matrix = pdist(embeddings_np, metric='cosine')
    Z = linkage(dist_matrix, method='average')
    labels = fcluster(Z, t=threshold, criterion='distance')
    return labels

def find_exemplar(cluster_indices, embeddings_np, concepts):
    """
    Finds the concept closest to the average embedding (centroid) of the cluster using Cosine Similarity
    """
    if len(cluster_indices) == 1:
        return concepts[cluster_indices[0]]

    cluster_embs = embeddings_np[cluster_indices]
    centroid = cluster_embs.mean(axis=0)
    
    norms = np.linalg.norm(cluster_embs, axis=1)
    centroid_norm = np.linalg.norm(centroid)
    
    if centroid_norm > 1e-9:
        similarities = np.dot(cluster_embs, centroid) / (norms * centroid_norm)
        best_local_idx = np.argmax(similarities)
        return concepts[cluster_indices[best_local_idx]]
    else:
        return concepts[cluster_indices[0]]

def main():
    base_dir = Path(__file__).resolve().parent
    json_path = base_dir / "extracted_metaphors.json"
    report_path = base_dir / "clustering_and_mapping_report.txt"

    DISTANCE_THRESHOLD = 0.35  # Max cosine distance to merge (corresponds to >= 0.65 similarity)

    if not json_path.exists():
        print(f"Error: {json_path} not found. Please run extract_metaphors.py first.")
        sys.exit(1)

    print(f"Reading from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        metaphors = json.load(f)

    # Gather and normalize Target (x) and Source (y) concepts
    targets_list = []
    sources_list = []
    mapping_pairs = []

    for item in metaphors:
        x_val = item.get("x", "").strip().title()
        y_val = item.get("y", "").strip().title()
        relation = item.get("relation", "is").strip().upper() # Keep 'IS' or 'ARE'
        
        if x_val and y_val:
            targets_list.append(x_val)
            sources_list.append(y_val)
            mapping_pairs.append((x_val, relation, y_val))

    unique_targets = sorted(list(set(targets_list)))
    unique_sources = sorted(list(set(sources_list)))

    print(f"Found {len(unique_targets)} unique target concepts.")
    print(f"Found {len(unique_sources)} unique source concepts.")
    print(f"Total mappings: {len(mapping_pairs)}")

    # Load phrase embedding model
    print("\nLoading phrase embedding model (sentence-transformers/all-MiniLM-L6-v2)...")
    tokenizer = AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2')
    model = AutoModel.from_pretrained('sentence-transformers/all-MiniLM-L6-v2')

    print("Computing target concept embeddings...")
    target_embs_torch = get_embeddings(unique_targets, tokenizer, model)
    target_embeddings = target_embs_torch.cpu().numpy()
    
    print("Computing source concept embeddings...")
    source_embs_torch = get_embeddings(unique_sources, tokenizer, model)
    source_embeddings = source_embs_torch.cpu().numpy()

    # Perform Hierarchical Agglomerative Clustering
    print(f"\nClustering targets (threshold={DISTANCE_THRESHOLD})...")
    target_labels = hierarchical_clustering(target_embeddings, DISTANCE_THRESHOLD)
    unique_target_labels = np.unique(target_labels)
    
    print(f"Clustering sources (threshold={DISTANCE_THRESHOLD})...")
    source_labels = hierarchical_clustering(source_embeddings, DISTANCE_THRESHOLD)
    unique_source_labels = np.unique(source_labels)

    print(f"\nGenerated {len(unique_target_labels)} target clusters and {len(unique_source_labels)} source clusters.")

    # Gather Target-Source mapping statistics
    target_to_source = {}
    source_to_target = {}
    
    for t, rel, s in mapping_pairs:
        target_to_source.setdefault(t, []).append((rel, s))
        source_to_target.setdefault(s, []).append((rel, t))

    # Compile Top Mappings
    top_mappings = Counter(mapping_pairs).most_common(15)

    # Output Report
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("MASTER METAPHOR LIST - HIERARCHICAL CLUSTERING & MAPPING REPORT\n")
        f.write("="*80 + "\n\n")

        # Section 1: Top Mappings
        f.write("SECTION 1: TOP CONCEPTUAL METAPHOR MAPPINGS (By Frequency)\n")
        f.write("-" * 80 + "\n")
        for (t, rel, s), count in top_mappings:
            f.write(f"- {t} {rel} {s} ({count} occurrences)\n")
        f.write("\n" + "="*80 + "\n\n")

        # Section 2: Target Concept Clusters
        f.write("SECTION 2: TARGET CONCEPT CLUSTERS (Abstract Concepts)\n")
        f.write("-" * 80 + "\n")
        f.write(f"Parameters: Cosine Distance Threshold = {DISTANCE_THRESHOLD} (at least {1-DISTANCE_THRESHOLD:.2f} similarity)\n\n")
        
        target_cluster_info = []
        for label in unique_target_labels:
            indices = np.where(target_labels == label)[0]
            exemplar = find_exemplar(indices, target_embeddings, unique_targets)
            items = [unique_targets[i] for i in indices]
            target_cluster_info.append((label, exemplar, items))
            
        target_cluster_info.sort(key=lambda x: len(x[2]), reverse=True)
        
        for idx, (label, exemplar, items) in enumerate(target_cluster_info, 1):
            f.write(f"Cluster #{idx} [Exemplar: {exemplar}] (Size: {len(items)})\n")
            f.write(f"  Items: {', '.join(items[:20])}")
            if len(items) > 20:
                f.write(f" ... (+{len(items)-20} more)")
            f.write("\n\n")
            
        f.write("="*80 + "\n\n")

        # Section 3: Source Concept Clusters
        f.write("SECTION 3: SOURCE CONCEPT CLUSTERS (Concrete/Physical Domains)\n")
        f.write("-" * 80 + "\n")
        f.write(f"Parameters: Cosine Distance Threshold = {DISTANCE_THRESHOLD} (at least {1-DISTANCE_THRESHOLD:.2f} similarity)\n\n")
        
        source_cluster_info = []
        for label in unique_source_labels:
            indices = np.where(source_labels == label)[0]
            exemplar = find_exemplar(indices, source_embeddings, unique_sources)
            items = [unique_sources[i] for i in indices]
            source_cluster_info.append((label, exemplar, items))
            
        source_cluster_info.sort(key=lambda x: len(x[2]), reverse=True)

        for idx, (label, exemplar, items) in enumerate(source_cluster_info, 1):
            f.write(f"Cluster #{idx} [Exemplar: {exemplar}] (Size: {len(items)})\n")
            f.write(f"  Items: {', '.join(items[:20])}")
            if len(items) > 20:
                f.write(f" ... (+{len(items)-20} more)")
            f.write("\n\n")

        f.write("="*80 + "\n\n")

        # Section 4: Target-to-Source Mappings Details
        f.write("SECTION 4: TARGET → SOURCE MAPPINGS (How abstract concepts are structured)\n")
        f.write("-" * 80 + "\n")
        sorted_targets_by_freq = sorted(target_to_source.keys(), key=lambda t: len(target_to_source[t]), reverse=True)
        for t in sorted_targets_by_freq[:30]:  # Show top 30 targets
            sources_counts = Counter([f"{rel} {s}" for rel, s in target_to_source[t]])
            sources_str = ", ".join([f"{s_descr} ({c}x)" for s_descr, c in sources_counts.items()])
            f.write(f"- {t} ({len(target_to_source[t])} mappings) is structured by:\n")
            f.write(f"  → {sources_str}\n\n")

        f.write("="*80 + "\n\n")

        # Section 5: Source-to-Target Mappings Details
        f.write("SECTION 5: SOURCE → TARGET MAPPINGS (How concrete domains structure other things)\n")
        f.write("-" * 80 + "\n")
        sorted_sources_by_freq = sorted(source_to_target.keys(), key=lambda s: len(source_to_target[s]), reverse=True)
        for s in sorted_sources_by_freq[:30]:  # Show top 30 sources
            targets_counts = Counter([f"{rel} {t}" for rel, t in source_to_target[s]])
            targets_str = ", ".join([f"{t_descr} ({c}x)" for t_descr, c in targets_counts.items()])
            f.write(f"- {s} ({len(source_to_target[s])} mappings) structures:\n")
            f.write(f"  → {targets_str}\n\n")

    print(f"\nProcessing Complete!")
    print(f"Saved complete hierarchical clustering and mapping report to: {report_path}")

if __name__ == "__main__":
    main()

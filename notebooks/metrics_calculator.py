"""
ISU-GeoBot Thesis — Computational Metrics & Formula Engine (Chapter 3 & 4)

Provides rigorous mathematical implementations and computations for:
1. Machine Learning Performance (Gini, Accuracy, Precision, Recall, F1, Macro-F1, Confusion Matrix)
2. RAGAS Technical Evaluation (Context Precision@K, Context Recall, Faithfulness, Answer Relevancy, Latency)
3. Faculty Functional Validation (Ground Truth Matrix, Correctness Rates, Nielsen-Faulkner Coverage)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd


# =====================================================================
# TRACK A: MACHINE LEARNING AVAILABILITY METRICS (Thesis §3.5.2 & §3.7)
# =====================================================================

def compute_gini_impurity(class_counts: List[int]) -> float:
    """
    Computes Gini Impurity for a decision tree node:
        I_G(p) = 1 - sum_{i=1}^J p_i^2
    """
    total = sum(class_counts)
    if total == 0:
        return 0.0
    probabilities = [count / total for count in class_counts]
    return 1.0 - sum(p ** 2 for p in probabilities)


@dataclass
class ClassificationReport:
    accuracy: float
    macro_f1: float
    weighted_f1: float
    per_class_metrics: Dict[str, Dict[str, float]]
    confusion_matrix: np.ndarray
    classes: List[str]


def compute_multiclass_metrics(
    y_true: List[str] | np.ndarray,
    y_pred: List[str] | np.ndarray,
    classes: List[str] | None = None,
) -> ClassificationReport:
    """
    Computes Accuracy, Precision, Recall, F1-Score (per class, Macro, and Weighted)
    along with the full NxN Confusion Matrix.
    """
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)

    if classes is None:
        classes = sorted(list(set(y_true) | set(y_pred)))

    n_classes = len(classes)
    class_to_idx = {c: i for i, c in enumerate(classes)}
    cm = np.zeros((n_classes, n_classes), dtype=int)

    for yt, yp in zip(y_true, y_pred):
        if yt in class_to_idx and yp in class_to_idx:
            cm[class_to_idx[yt], class_to_idx[yp]] += 1

    total_samples = len(y_true)
    correct_samples = sum(cm[i, i] for i in range(n_classes))
    overall_accuracy = correct_samples / total_samples if total_samples > 0 else 0.0

    per_class = {}
    f1_list = []
    support_list = []

    for i, c in enumerate(classes):
        tp = cm[i, i]
        fp = sum(cm[j, i] for j in range(n_classes) if j != i)
        fn = sum(cm[i, j] for j in range(n_classes) if j != i)
        support = sum(cm[i, :])

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        per_class[c] = {
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
            "support": int(support),
            "tp": int(tp),
            "fp": int(fp),
            "fn": int(fn),
        }
        f1_list.append(f1)
        support_list.append(support)

    macro_f1 = float(np.mean(f1_list)) if f1_list else 0.0
    weighted_f1 = (
        float(sum(f * s for f, s in zip(f1_list, support_list)) / sum(support_list))
        if sum(support_list) > 0
        else 0.0
    )

    return ClassificationReport(
        accuracy=float(overall_accuracy),
        macro_f1=macro_f1,
        weighted_f1=weighted_f1,
        per_class_metrics=per_class,
        confusion_matrix=cm,
        classes=classes,
    )


# =====================================================================
# TRACK B: RAGAS QUALITY METRICS (Technical AI Evaluation - Thesis §3.8.1)
# =====================================================================

def compute_context_precision_at_k(
    retrieved_chunk_ids: List[str],
    ground_truth_relevant_ids: List[str],
    k: int = 5,
) -> float:
    """
    Context Precision@K:
        CP@K = sum_{k=1}^K (Precision@k * v_k) / Total Relevant Chunks in Top K
    where v_k = 1 if chunk_k is relevant, else 0.
    """
    top_k = retrieved_chunk_ids[:k]
    gt_set = set(ground_truth_relevant_ids)
    
    hits = 0
    precision_sum = 0.0
    total_relevant = len([c for c in top_k if c in gt_set])

    if total_relevant == 0:
        return 0.0

    for idx, chunk_id in enumerate(top_k, start=1):
        if chunk_id in gt_set:
            hits += 1
            precision_at_idx = hits / idx
            precision_sum += precision_at_idx

    return precision_sum / total_relevant


def compute_context_recall(
    ground_truth_sentences: List[str],
    retrieved_contexts: List[str],
) -> float:
    """
    Context Recall:
        Recall = |Ground-truth sentences supported by retrieved context| / |Total ground-truth sentences|
    """
    if not ground_truth_sentences:
        return 1.0
    
    combined_context = " ".join(retrieved_contexts).lower()
    attributed = 0

    for sent in ground_truth_sentences:
        # Check semantic overlap / key phrase containment
        words = [w.lower() for w in sent.split() if len(w) > 3]
        if not words:
            attributed += 1
            continue
        overlap = sum(1 for w in words if w in combined_context)
        if overlap / len(words) >= 0.5:
            attributed += 1

    return attributed / len(ground_truth_sentences)


def compute_faithfulness(
    generated_claims: List[str],
    retrieved_contexts: List[str],
) -> float:
    """
    Faithfulness:
        Faithfulness = |Claims inferrable from retrieved context| / |Total generated claims|
    """
    if not generated_claims:
        return 1.0
    
    combined_context = " ".join(retrieved_contexts).lower()
    supported = 0

    for claim in generated_claims:
        words = [w.lower() for w in claim.split() if len(w) > 3]
        if not words:
            supported += 1
            continue
        overlap = sum(1 for w in words if w in combined_context)
        if overlap / len(words) >= 0.5:
            supported += 1

    return supported / len(generated_claims)


def compute_cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Cosine similarity between two embedding vectors."""
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


def compute_answer_relevancy(
    original_query_embedding: np.ndarray,
    generated_question_embeddings: List[np.ndarray],
) -> float:
    """
    Answer Relevancy:
        AR = (1/N) * sum_{i=1}^N cos(E_gi, E_q)
    """
    if not generated_question_embeddings:
        return 0.0
    sims = [compute_cosine_similarity(g_emb, original_query_embedding) for g_emb in generated_question_embeddings]
    return float(np.mean(sims))


# =====================================================================
# TRACK C: FACULTY FUNCTIONAL VALIDATION (Thesis §3.8.2 & §3.9)
# =====================================================================

def compute_faulkner_problem_discovery_rate(
    num_evaluators: int = 15,
    p_individual_discovery: float = 0.20,
) -> float:
    """
    Nielsen (1994) & Faulkner (2003) Problem Discovery Coverage:
        P(detection) = 1 - (1 - p)^n
    """
    return 1.0 - math.pow(1.0 - p_individual_discovery, num_evaluators)


def compute_validation_summary(
    validation_records: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Summarizes faculty functional validation entries:
    - Overall accuracy rate (Correct / Total verified)
    - Breakdown of correct, partially correct, incorrect
    - Confusion Matrix between Predicted and Actual
    """
    total = len(validation_records)
    if total == 0:
        return {
            "total_verified": 0,
            "accuracy_rate": 0.0,
            "correct_count": 0,
            "partially_correct_count": 0,
            "incorrect_count": 0,
        }

    correct = sum(1 for r in validation_records if r.get("correctness") == "correct")
    partial = sum(1 for r in validation_records if r.get("correctness") == "partially_correct")
    incorrect = sum(1 for r in validation_records if r.get("correctness") == "incorrect")

    accuracy_rate = (correct / total) * 100.0

    return {
        "total_verified": total,
        "accuracy_rate": float(accuracy_rate),
        "correct_count": correct,
        "partially_correct_count": partial,
        "incorrect_count": incorrect,
        "correct_percent": (correct / total) * 100.0,
        "partially_correct_percent": (partial / total) * 100.0,
        "incorrect_percent": (incorrect / total) * 100.0,
    }


# =====================================================================
# EXPORT FORMATTERS (LaTeX, Markdown, CSV for Thesis Chapter 4)
# =====================================================================

def report_to_markdown_table(report: ClassificationReport, title: str = "Classification Report") -> str:
    """Formats classification report into a GitHub Markdown table."""
    lines = [
        f"### {title}",
        "",
        "| Category / Class | Precision | Recall | F1-Score | Support (n) |",
        "| :--- | :---: | :---: | :---: | :---: |",
    ]
    for c in report.classes:
        m = report.per_class_metrics[c]
        lines.append(
            f"| `{c}` | {m['precision']:.4f} | {m['recall']:.4f} | {m['f1_score']:.4f} | {m['support']} |"
        )
    lines.append("| :--- | :---: | :---: | :---: | :---: |")
    lines.append(f"| **Overall Accuracy** | — | — | **{report.accuracy:.4f}** | {sum(m['support'] for m in report.per_class_metrics.values())} |")
    lines.append(f"| **Macro Average** | — | — | **{report.macro_f1:.4f}** | — |")
    lines.append(f"| **Weighted Average** | — | — | **{report.weighted_f1:.4f}** | — |")
    lines.append("")
    return "\n".join(lines)


def report_to_latex_table(report: ClassificationReport, caption: str = "Model Classification Performance") -> str:
    """Formats classification report into LaTeX table code for Chapter 4."""
    lines = [
        r"\begin{table}[htbp]",
        r"\centering",
        f"\\caption{{{caption}}}",
        r"\begin{tabular}{lcccc}",
        r"\hline",
        r"\textbf{Class / Category} & \textbf{Precision} & \textbf{Recall} & \textbf{F1-Score} & \textbf{Support} \\",
        r"\hline",
    ]
    for c in report.classes:
        m = report.per_class_metrics[c]
        clean_name = c.replace("_", r"\_")
        lines.append(
            f"{clean_name} & {m['precision']:.4f} & {m['recall']:.4f} & {m['f1_score']:.4f} & {m['support']} \\\\"
        )
    lines.append(r"\hline")
    lines.append(f"\\textbf{{Overall Accuracy}} & \\multicolumn{{3}}{{c}}{{\\textbf{{{report.accuracy * 100:.2f}\\%}}}} & {sum(m['support'] for m in report.per_class_metrics.values())} \\\\")
    lines.append(f"\\textbf{{Macro Average F1}} & \\multicolumn{{3}}{{c}}{{\\textbf{{{report.macro_f1:.4f}}}}} & -- \\\\")
    lines.append(r"\hline")
    lines.append(r"\end{tabular}")
    lines.append(r"\label{tab:model_performance}")
    lines.append(r"\end{table}")
    return "\n".join(lines)

---
title: "Effects of Zero-Shot Chain-of-Thought Prompting on Medium Language Models Versus Distilled Reasoning Models"
sub_title: "Thesis Defence"
author: "Yves Donato"
---

Overview
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
This presentation covers:

1. **Research problem and motivation**
2. **Comparison framework**
3. **Methodology and metrics**
4. **Main findings**
5. **Interpretation**
6. **Limitations and future work**

<!-- end_slide -->

Research Problem
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
Large language models increasingly claim **reasoning** ability, but there are still limited controlled comparisons between:

- **Prompt-only reasoning**
  - Zero-Shot Chain-of-Thought (ZS-CoT)
- **Training-time reasoning mechanisms**
  - RLHF-based reasoning behavior
  - Distillation from a reasoning teacher

<!-- pause -->
The central problem is:

**Does a simple reasoning prompt meaningfully close the gap with models explicitly optimized for reasoning?**

<!-- end_slide -->

Research Questions
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
This thesis asks:

1. **How does ZS-CoT prompting compare to internal reasoning mechanisms such as RLHF with Chain-of-Thought examples and distillation of a reasoning model?**
2. **Is the number of tokens a model spends on reasoning correlated with performance?**

<!-- pause -->
The goal is not just to compare accuracy, but to compare **accuracy under cost**.

<!-- end_slide -->

Why This Comparison Is Fair
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
To compare reasoning methods fairly, each tested family should have:

- A **reasoning model**
- A **clearly specified base model**
- The **same architecture**
- The **same parameter size**

<!-- pause -->
The DeepSeek-R1 family is useful because it provides explicit base-model matches, allowing direct comparison between:

- **Base model**
- **Base model + ZS-CoT**
- **DeepSeek-R1 distilled reasoning model**

<!-- end_slide -->

Background - What Is Being Compared?
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
Three comparison conditions are central to this thesis:

- **Baseline prompting**
  - direct answering without ZS-CoT
- **ZS-CoT prompting**
  - adds an instruction such as *"Let's think step by step"*
- **Distilled reasoning models**
  - trained to inherit reasoning behavior from a stronger teacher

<!-- pause -->
This creates a direct comparison between **prompt-time reasoning** and **training-time reasoning optimization**.

<!-- end_slide -->

Evaluation Metrics
===
<!-- alignment: left -->
Accuracy is measured as:
<!-- pause -->

$$
\text{Accuracy}(\%) = 100 \cdot \frac{N_{\text{correct}}}{N}
$$

<!-- pause -->
Efficiency is measured as:

$$
T_{avg} = \frac{\sum_{i=1}^{N} T_i}{N}
$$

$$
\text{Efficiency} = \frac{\text{Accuracy}^2}{T_{avg}}
$$

<!-- pause -->
Why this matters:

- Accuracy alone can hide inference cost.
- Token usage acts as a practical proxy for reasoning cost.

<!-- end_slide -->

Why AIME 2025?
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
AIME 2025 was selected because it is:

- A **reasoning-heavy math benchmark**
- Short enough to support repeated local experiments
- New enough to reduce contamination concerns for the tested models
- Easy to score because answers are integers from **0 to 999**

<!-- pause -->
The dataset contains **30 test cases**, which made it practical to:

- test multiple models
- rerun experiments
- manually inspect outputs when needed

<!-- end_slide -->

Methodology
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
The benchmark pipeline is:

1. Load AIME 2025 questions.
2. Run each model locally under controlled settings.
3. Record the raw response for every question.
4. Use a second model to extract the final numeric answer.
5. Store each result as structured JSONL.
6. Compare extracted answers against ground truth.
7. Compute accuracy, tokens, and efficiency.

<!-- pause -->
Controlled variables include:

- **context length**
- **quantization**
- **temperature**

<!-- end_slide -->

Tested Model Pairs
===
```latex +render
\begin{table}[h]
    \par
    \bigskip
    \centering
    \begin{tabular}{ m{6cm} m{6cm} }
        \hline
        Distilled Model & Base Model \\
        \hline
        DeepSeek-R1-Distill-Llama-8B & Llama-3.1-8B \\
        DeepSeek-R1-Distill-Qwen-14B & Qwen2.5-14B \\
        DeepSeek-R1-Distill-Qwen-32B & Qwen2.5-32B \\
        DeepSeek-R1-Distill-Llama-70B & Llama-3.3-70B-Instruct \\
        \hline
    \end{tabular}
\end{table}
```
<!-- alignment: center -->
Figure 1: Matched model families used for direct comparison

<!-- end_slide -->

Main Results - Direct Comparisons
===
<!-- alignment: center -->
Distilled DeepSeek-R1 models consistently outperform their matched base and ZS-CoT conditions in accuracy.

<!-- pause -->
```latex +render
\begin{table}[h]
    \par
    \bigskip
    \centering
    \begin{tabular}{ m{5.8cm} m{2.5cm} m{2.5cm} }
        \hline
        Model & \centerline{Accuracy} & \centerline{Efficiency} \\
        \hline
        Llama3.1:8B-Baseline@Q8 & \centerline{3%} & \centerline{0.0025} \\
        Llama3.1:8B-CoT@Q8 & \centerline{0%} & \centerline{0.0000} \\
        \textbf{DeepSeek-R1:8B@Q8} & \centerline{\textbf{43%}} & \centerline{\textbf{0.1345}} \\
        \hline
        Qwen2.5:14B-Baseline@Q8 & \centerline{10%} & \centerline{0.1122} \\
        Qwen2.5:14B-CoT@Q8 & \centerline{10%} & \centerline{0.1104} \\
        \textbf{DeepSeek-R1:14B@Q8} & \centerline{\textbf{43.3%}} & \centerline{\textbf{0.1480}} \\
        \hline
        Qwen2.5:32B-Baseline@Q8 & \centerline{13%} & \centerline{0.2089} \\
        Qwen2.5:32B-CoT@Q8 & \centerline{13%} & \centerline{0.2079} \\
        \textbf{DeepSeek-R1:32B@Q8} & \centerline{\textbf{50%}} & \centerline{0.1907} \\
        \hline
        Llama3.3:70B-Baseline@Q4@16k & \centerline{7%} & \centerline{0.0502} \\
        Llama3.3:70B-CoT@Q4@16k & \centerline{7%} & \centerline{0.0517} \\
        \textbf{DeepSeek-R1:70B@Q4@16k} & \centerline{\textbf{50%}} & \centerline{\textbf{0.2033}} \\
        \hline
    \end{tabular}
\end{table}
```

<!-- end_slide -->

Main Results - Token Usage
===
```latex +render
\begin{table}[h]
    \par
    \bigskip
    \centering
    \begin{tabular}{ m{6cm} m{3cm} }
        \hline
        Model & \centerline{Mean Tokens} \\
        \hline
        Llama3.1:8B-Baseline@Q8 & \centerline{4401} \\
        Llama3.1:8B-CoT@Q8 & \centerline{903} \\
        DeepSeek-R1:8B@Q8 & \centerline{13960} \\
        Qwen2.5:14B-Baseline@Q8 & \centerline{892} \\
        Qwen2.5:14B-CoT@Q8 & \centerline{906} \\
        DeepSeek-R1:14B@Q8 & \centerline{12688} \\
        Qwen2.5:32B-Baseline@Q8 & \centerline{851} \\
        Qwen2.5:32B-CoT@Q8 & \centerline{855} \\
        DeepSeek-R1:32B@Q8 & \centerline{13107} \\
        Llama3.3:70B-Baseline@Q4@16k & \centerline{886} \\
        Llama3.3:70B-CoT@Q4@16k & \centerline{859} \\
        DeepSeek-R1:70B@Q4@16k & \centerline{12299} \\
        \hline
    \end{tabular}
\end{table}
```

<!-- pause -->
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
Key takeaway:

- Distilled reasoning models are usually **more accurate**
- But they often use **substantially more tokens**
- ZS-CoT does **not** reliably improve the accuracy-cost trade-off for the smaller base models studied

<!-- end_slide -->

10-Run Repeated Evaluation
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
To measure run-to-run variability under stochastic decoding, a **10-run paired study** was conducted on **Qwen2.5-14B**.

<!-- pause -->
```latex +render
\begin{table}[h]
    \par
    \bigskip
    \centering
    \begin{tabular}{ m{5.8cm} m{2cm} m{1.6cm} m{1.8cm} m{1.8cm} }
        \hline
        Model & \centerline{Mean Acc.} & \centerline{SD} & \centerline{CI low} & \centerline{CI high} \\
        \hline
        Qwen2.5-14B-baseline@0.6 & \centerline{9.67%} & \centerline{2.92} & \centerline{7.58} & \centerline{11.75} \\
        Qwen2.5-14B-CoT@0.6 & \centerline{8.00%} & \centerline{3.91} & \centerline{5.20} & \centerline{10.80} \\
        \hline
    \end{tabular}
\end{table}
```

<!-- pause -->
The repeated-run result stays qualitatively consistent:

- ZS-CoT did **not** deliver a stable improvement over baseline
- observed differences were small relative to variance

<!-- end_slide -->

Statistical Interpretation
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
For the 10-run study:

- **McNemar test:** no significant difference in accuracy between baseline and ZS-CoT
- **Shapiro-Wilk test on token differences:** normality not rejected
- **Paired t-test on mean tokens:** appropriate under the observed normality result

<!-- pause -->
Interpretation:

- single-run prompt comparisons can be misleading
- repeated trials are important on hard reasoning benchmarks
- ZS-CoT effects here are modest relative to stochastic decoding variance

<!-- end_slide -->

Discussion
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
Across the tested DeepSeek-R1 scales on AIME 2025:

- generic **"Let's think step by step"** prompting was **not** a dependable improvement for the smaller base models studied
- any gain from ZS-CoT was usually too small to justify its cost under this setup
- the strongest gains were associated with **training-time reasoning optimization**, especially **distillation**

<!-- pause -->
This suggests that prompt-only reasoning is **benchmark-dependent** and **scale-dependent**, rather than universally effective.

<!-- end_slide -->

Limitations and Future Work
===
<!-- incremental_lists: true -->
<!-- list_item_newlines: 2 -->
Limitations:

- Results are specific to **AIME 2025** and the tested model/configuration set
- Latency and token costs remain partly hardware-dependent
- The two-model extraction pipeline can introduce answer-extraction error

<!-- pause -->
Future work:

- evaluate more math and multi-domain reasoning benchmarks
- sweep model sizes more finely to locate transition points for ZS-CoT usefulness
- explore cost-controlled methods such as selective reasoning or concise rationales
- compare prompting against lightweight post-training methods more directly

<!-- end_slide -->

Conclusion
===
<!-- alignment: center -->

This thesis finds that **ZS-CoT is not a reliable, cost-effective way to improve AIME 2025 performance for the smaller base models studied here.**

<!-- alignment: left -->
<!-- pause -->
For this benchmark and evaluation setting:
- **distilled reasoning models** gave the strongest accuracy gains
- **ZS-CoT** did not consistently outperform direct answering
- reasoning should be evaluated using **uncertainty estimates and efficiency metrics**, not accuracy alone

<!-- end_slide -->

References
===
[1] Takeshi Kojima, Shixiang Shane Gu, Machel Reid, Yutaka Matsuo, and Yusuke Iwasawa. *Large Language Models are Zero-Shot Reasoners*, 2023.

[2] DeepSeek-AI et al. *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*, 2025.

[3] Jason Wei et al. *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*, 2023.

[4] Long Ouyang et al. *Training Language Models to Follow Instructions with Human Feedback*, 2022.

[5] Lin et al. Efficiency metric reference used in the thesis.

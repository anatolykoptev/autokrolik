# Human-on-the-Loop Framework для AI Automation (2026)

## Философия: Agents 70-90% автономно, Humans для edge-cases

**Human-on-the-Loop** означает: агент выполняет 70-90% работы **полностью автономно**, и только для сложных/рисковых случаев он **escalates** на человека. Это не "AI помогает людям", это "люди надзирают AI".

**Ключевое отличие от Human-in-the-Loop**:
- **Human-in-the-Loop (HITL)**: Люди делают основную работу, AI помогает
- **Human-on-the-Loop (HOTL)**: Agents делают 70-90% работы автономно, escalate для ~10-30% edge-cases

Формула: **High-Quality Model + Context + Tooling + Escalation Logic = High Automation**

***

## Архитектурные Компоненты

### 1. Tier-Based Complexity Matching

Не все задачи требуют полного agentic reasoning:

```
Tier 0 (Rules Engine) — 60% случаев
  Простые правила, regex, deterministic logic
  
Tier 1 (Single LLM Call) — 20% случаев
  Одного LLM call достаточно, есть tool calling
  
Tier 2 (Tool-Augmented Execution) — 15% случаев
  Нужно планирование + несколько инструментов
  
Tier 3 (Multi-Agent Orchestration) — 5% случаев
  Непредсказуемые пути выполнения, сложное рассуждение
```

**Сигнал**: если можешь написать 10-20 правил, покрывающих 60%+ случаев → Tier 0. Если нужен flowchart на 80% — только тогда Tier 2+.

***

### 2. Autonomous Execution with Escalation Boundaries

**Layer 1: Autonomous Zone** (70-80% работы)
- Agent выполняет независимо
- Low-risk actions (data retrieval, analysis, routing)
- Ясные критерии успеха
- *Пример*: классификация ticket → routing в очередь

**Layer 2: Human-on-the-Loop Zone** (10-20% работы)
- Agent пробует выполнить, но escalates при неуверенности
- Human reviews, approves, или redirects
- Контекст сохраняется; agent ждёт решения
- *Пример*: возврат денег > $500 → одобрение менеджера → agent выполняет

**Layer 3: Hard Boundary** (5-10% работы)
- Agent сразу stop
- Требует human intervention by design
- High-stakes, regulatory, novel situations
- *Пример*: security exception, legal risk

***

## Framework Selection: LangGraph для Autonomous Layer

**Почему LangGraph**:
- **Graph-based control**: каждый шаг — явный node, зависимости видны
- **State management**: поддерживает контекст через 100s шагов
- **Checkpointing**: resume с точного места ошибки
- **Deterministic replay**: audit trail для compliance
- **Escalation patterns**: встроены в сам граф

### Паттерн реализации:

```python
from langgraph.graph import StateGraph, START, END

workflow = StateGraph(AgentState)

# Autonomous узлы
workflow.add_node("classify", classify_task)
workflow.add_node("execute", execute_autonomously)
workflow.add_node("validate", validate_output)

# Escalation узлы
workflow.add_node("escalate", escalate_to_human)
workflow.add_node("wait_for_approval", wait_for_human_input)
workflow.add_node("resume_from_approval", resume_execution)

# Decision points (логика escalation)
workflow.add_conditional_edges(
    "validate",
    should_escalate,  # returns "escalate" or "continue"
    {
        "escalate": "escalate_to_human",
        "continue": "execute_autonomously",
    }
)

workflow.add_edge(START, "classify")
workflow.add_edge("escalate_to_human", "wait_for_approval")
workflow.add_edge("wait_for_approval", "resume_from_approval")
```

**Преимущества LangGraph для HOTL**:
- Ясный audit trail (каждый node логируется)
- Human может осмотреть full state в escalation point
- Agent resumes с полным контекстом после решения
- Cost-efficient (escalate рано, не трать токены на uncertainty)

***

## Escalation Framework (Core Implementation)

### 1. Определи категории escalation

```python
ESCALATION_RULES = {
    "CONFIDENCE": {
        "threshold": 0.75,  # Если confidence < 75% → escalate
        "description": "Model uncertainty"
    },
    "FINANCIAL": {
        "threshold": 500,  # Возврат > $500 → escalate
        "description": "Cost-based auto-escalation"
    },
    "COMPLIANCE": {
        "rules": ["security_exception", "data_risk", "legal_review"],
        "description": "Mandatory human zones"
    },
    "NOVEL": {
        "signal": "task_type_not_seen_before",
        "description": "Новые паттерны → escalate"
    },
    "MULTI_STAKEHOLDER": {
        "signal": "requires_approval_from_multiple_teams",
        "description": "Decisions affecting >1 dept"
    }
}
```

### 2. Escalation Decision Function

```python
def should_escalate(state: AgentState) -> str:
    """
    Decides if agent should escalate to human.
    Returns: "CONTINUE_AUTONOMOUS" or "ESCALATE_TO_HUMAN"
    """
    
    # Check confidence
    if state.model_confidence < 0.75:
        state.escalation_reason = "LOW_CONFIDENCE"
        return "ESCALATE_TO_HUMAN"
    
    # Check financial limits
    if state.action_type == "refund" and state.amount > 500:
        state.escalation_reason = "FINANCIAL_THRESHOLD"
        return "ESCALATE_TO_HUMAN"
    
    # Check compliance zones
    if state.action_type in ["security_exception", "data_access"]:
        state.escalation_reason = "COMPLIANCE_REQUIREMENT"
        return "ESCALATE_TO_HUMAN"
    
    # Check for novel patterns
    if not state.similar_cases_found:
        state.escalation_reason = "NOVEL_PATTERN"
        return "ESCALATE_TO_HUMAN"
    
    # Default: continue autonomous
    return "CONTINUE_AUTONOMOUS"
```

### 3. Escalation Message Format

Когда escalate, сохраняй full context:

```python
ESCALATION_TEMPLATE = {
    "escalation_id": "esc_20260125_001",
    "timestamp": "2026-01-25T12:34:56Z",
    "task": "customer_refund_request",
    "reason": "FINANCIAL_THRESHOLD",
    "context": {
        "customer_id": "cust_123",
        "refund_amount": 750,
        "purchase_date": "2026-01-10",
        "return_reason": "damaged_in_shipping",
        "agent_analysis": "Legitimate claim, within return window"
    },
    "agent_recommendation": "APPROVE_REFUND",
    "next_steps": [
        "Human reviews agent analysis",
        "Human approves/rejects/modifies",
        "Decision sent back to agent",
        "Agent executes (if approved) or notifies customer"
    ],
    "required_approval_from": ["supervisor"],
    "expected_sla": "4_hours"
}
```

***

## Integration Pattern: LangGraph + n8n (Hybrid)

```
n8n Visual Workflow (integrations layer)
  ↓ triggers
LangGraph Agent (Python; orchestration)
  ├─ Autonomous execution (classify → execute → validate)
  └─ Escalation decision points
     ├─ If escalate → HTTP webhook to n8n
     └─ n8n creates human task (Airtable, Slack, email)

Human approves/rejects in n8n
  ↓
Webhook response back to LangGraph
  ↓
Agent resumes from exact decision point
  ↓
n8n logs final result + metrics
```

### Pure LangGraph Setup (Simpler)

```python
class AgentState(TypedDict):
    task: str
    context: dict
    execution_path: list[str]
    escalation_queue: Optional[str]
    human_decision: Optional[str]
    final_result: Optional[str]

def escalate_to_human(state: AgentState) -> AgentState:
    # Format for human review
    review_message = format_escalation_message(state)
    
    # Send to queue (Slack, email, DB, webhook)
    send_to_review_queue(review_message)
    
    # Wait for human input
    state.escalation_queue = "PENDING_HUMAN_REVIEW"
    return state

def resume_from_human_decision(state: AgentState) -> AgentState:
    decision = state.human_decision  # "APPROVED", "REJECTED", "MODIFIED"
    
    if decision == "APPROVED":
        state.execution_path.append("execute_approved_action")
    elif decision == "REJECTED":
        state.execution_path.append("notify_user_rejection")
    elif decision == "MODIFIED":
        state.context.update(state.human_modifications)
        state.execution_path.append("execute_modified_action")
    
    return state
```

***

## Governance Layer

Человеческий надзор сдвигается от "review every output" к "design the rules":

```
1. DISCOVERY & INVENTORY
   Track all agents, autonomy levels, escalation rules
   
2. POLICY-AS-CODE
   Escalation thresholds, approval workflows (executable Python)
   
3. CONTINUOUS MONITORING
   Autonomy rates, escalation rates, resolution times
   
4. ANOMALY DETECTION
   Agent behavior drift, new pattern signals
   
5. AUDIT & ACCOUNTABILITY
   Full trace of decisions (agent + human)
   
6. RED TEAMING
   Regular tests of escalation logic, edge cases
```

### Key Metrics

```python
HOTL_METRICS = {
    "autonomy_rate": "% decisions без human",  # Target: 70-90%
    "escalation_rate": "% escalated",          # Target: 10-30%
    "escalation_accuracy": "% escalations that needed human", # >80%
    "resolution_time": "avg time escalation→approval",  # <4h
    "human_override_rate": "% human changed agent recommendation", # <5%
    "cost_per_task": "tokens + human review labor",
    "compliance_violations": "policy breaches",
    "user_satisfaction": "satisfaction with escalated resolution"
}
```

***

## Implementation Roadmap (8 Weeks)

### Week 1-2: Define Domains & Escalation Rules
- Pick 1 use case (customer refunds, ticket triage, content moderation)
- List all possible situations (routine vs. edge-case)
- Define escalation thresholds
- Create taxonomy (Confidence, Financial, Compliance, Novel)

### Week 3-4: Build Autonomous Layer
- Tier 0: Write rules for 60% of cases
- Tier 1: Build LLM classifier with high confidence thresholds
- Tier 2: Build tool-augmented execution (if needed)
- Test on historical data; measure baseline autonomy

### Week 5-6: Add Escalation Logic
- Implement `should_escalate()` function
- Build escalation message templates
- Create human review interface (n8n, Airtable, Slack, custom form)
- Add resume logic

### Week 7-8: Deploy & Monitor
- Canary deployment (5% traffic)
- Monitor: autonomy rate, escalation reasons, override rate
- Weekly review of misclassifications
- Refine thresholds based on data
- Scale to 100%

***

## Real-World Examples (2026 Production)

### Example 1: Customer Support Tickets

```
Input: Support ticket
  ↓
Agent classifies (sentiment, topic, priority)
  ├─ Simple question (FAQ answer) → AUTONOMOUS
  ├─ Standard issue (known solution) → AUTONOMOUS
  └─ Complex/angry/novel → ESCALATE

Escalation check:
  - confidence < 0.8 → escalate
  - requires human judgment → escalate
  - multi-issue ticket → escalate
  
If escalate:
  - Format context for human
  - Route to correct team
  - Human reviews agent's analysis
  - Human responds or modifies
  - Agent executes follow-up if needed
```

### Example 2: Financial Refunds

```
Input: Refund request
  ↓
Agent validates:
  - Refund within policy? → AUTONOMOUS
  - Refund < $500? → AUTONOMOUS
  - Refund > $500 OR outside policy → ESCALATE
  
If escalate:
  - Calculate risk (customer history, dispute rate)
  - Provide recommendation to manager
  - Manager approves/rejects/modifies
  - Agent processes approved decision
  - Agent notifies customer
```

### Example 3: Content Moderation

```
Input: User-generated content
  ↓
Agent classifies (toxicity, spam, policy violation)
  ├─ Clear violation (high confidence) → AUTONOMOUS (remove)
  ├─ Borderline/low confidence → ESCALATE
  └─ Appeal from user → ESCALATE

Escalation:
  - Preserve original content + user context
  - Flag for human reviewer
  - Reviewer makes decision
  - Decision appeals to system (future training)
  - Agent executes (remove/restore) + notifies user
```

***

## Key Design Principles

### 1. Confidence Thresholds are Everything

```python
# High-stakes domains require high confidence
FINANCIAL_DECISION_MIN_CONFIDENCE = 0.95
SUPPORT_ROUTING_MIN_CONFIDENCE = 0.85
DATA_CLASSIFICATION_MIN_CONFIDENCE = 0.80

# If below threshold, escalate immediately
if model_confidence < threshold:
    escalate("LOW_CONFIDENCE")
```

### 2. Cost of Escalation vs. Cost of Error

- **If cost of error > cost of escalation** → escalate aggressively
  - *Example*: Refund fraud; cost of error ($500+) >> cost of escalation (5 min review) → escalate at 80% confidence

- **If cost of escalation > cost of error** → handle autonomously
  - *Example*: Email routing; cost of error (misrouted email) << cost of escalation → route at 60% confidence

### 3. Humans Design, AI Executes & Monitors

Humans shift from "reviewing every output" to:
1. Setting policies and thresholds
2. Defining escalation paths
3. Reviewing system behavior (not individual decisions)
4. Updating rules quarterly based on metrics

### 4. Observability is Non-Negotiable

Every decision point must be logged:

```python
{
    "task_id": "task_123",
    "step": "classify",
    "model_output": "category: refund",
    "confidence": 0.88,
    "decision": "escalate",
    "reason": "FINANCIAL_THRESHOLD",
    "human_action": "approved_refund",
    "final_result": "refund_processed",
    "timestamp": "2026-01-25T12:34:56Z"
}
```

***

## Technology Stack (Production Human-on-the-Loop)

| Layer | Tech | Why |
|-------|------|-----|
| **Orchestration** | LangGraph | Graph-based, state management, escalation patterns |
| **Model** | Claude 3.5 Sonnet or GPT-4 | High reasoning; low hallucination |
| **Tooling** | MCP + custom tools | Reliable integrations, no vendor lock-in |
| **Integrations** | n8n (platform) + webhooks | Visual for non-tech, scalable |
| **Escalation Queue** | Airtable + Slack + email | Simple, visible, familiar |
| **Observability** | Langfuse + custom logging | Track every decision point |
| **Deployment** | Docker + Python FastAPI | Simple, scalable, debuggable |

**Estimated Time-to-Production**: 4-6 weeks
**Cost at Scale**: Low (mostly API calls + your infrastructure)
**Autonomy Target**: 70-90%

***

## Quick Start Code

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Literal

class AgentState(TypedDict):
    task: str
    context: dict
    confidence: float
    escalation_reason: Optional[str]
    human_decision: Optional[str]
    result: Optional[str]

# Define nodes
def classify_and_analyze(state: AgentState) -> AgentState:
    """Analyze task and set confidence"""
    # Your classification logic here
    state.confidence = 0.85
    return state

def should_escalate(state: AgentState) -> Literal["escalate", "execute"]:
    """Determine escalation based on rules"""
    if state.confidence < 0.75:
        state.escalation_reason = "LOW_CONFIDENCE"
        return "escalate"
    
    if state.context.get("financial_amount", 0) > 500:
        state.escalation_reason = "FINANCIAL_THRESHOLD"
        return "escalate"
    
    return "execute"

def execute_autonomously(state: AgentState) -> AgentState:
    """Execute task without human intervention"""
    # Your execution logic here
    state.result = "executed_successfully"
    return state

def escalate_to_human(state: AgentState) -> AgentState:
    """Format and send to human for review"""
    print(f"Escalating: {state.escalation_reason}")
    print(f"Context: {state.context}")
    # In real implementation, send webhook/queue message
    return state

def wait_for_human_input(state: AgentState) -> AgentState:
    """Simulate waiting for human decision"""
    # In real implementation, this would be async webhook endpoint
    state.human_decision = "APPROVED"  # From external input
    return state

def resume_after_approval(state: AgentState) -> AgentState:
    """Continue execution after human decision"""
    if state.human_decision == "APPROVED":
        state.result = "executed_after_approval"
    else:
        state.result = "rejected_by_human"
    return state

# Build graph
workflow = StateGraph(AgentState)

workflow.add_node("classify", classify_and_analyze)
workflow.add_node("execute", execute_autonomously)
workflow.add_node("escalate", escalate_to_human)
workflow.add_node("wait_approval", wait_for_human_input)
workflow.add_node("resume", resume_after_approval)

workflow.add_edge(START, "classify")
workflow.add_conditional_edges(
    "classify",
    should_escalate,
    {"execute": "execute", "escalate": "escalate"}
)
workflow.add_edge("execute", END)
workflow.add_edge("escalate", "wait_approval")
workflow.add_edge("wait_approval", "resume")
workflow.add_edge("resume", END)

# Run
if __name__ == "__main__":
    app = workflow.compile()
    result = app.invoke({
        "task": "Process refund request",
        "context": {"customer_id": "123", "amount": 750},
        "confidence": 0.0,
        "escalation_reason": None,
        "human_decision": None,
        "result": None
    })
    print(result)
```

Вот. Полная архитектура, готовая к implementation. Это то, на чем строятся production системы в 2026 году для достижения 70-90% autonomy rate с proper human oversight.
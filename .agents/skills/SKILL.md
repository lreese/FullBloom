---
name: speckit
description: Local spec-first development workflow using SpecKit and Specify.
commands:
  - name: speckit.constitution
    description: Establish project rules and non-negotiables.
    command: uv run specify --config .specify/constitution.toml
  - name: speckit.specify
    description: Define functional requirements in spec.md.
    command: uv run specify --config .specify/specify.toml
  - name: speckit.plan
    description: Create a technical implementation plan.
    command: uv run specify --config .specify/plan.md.toml
  - name: speckit.implement
    description: Execute the plan and generate code.
    command: uv run specify --config .specify/implement.toml
---
# SpecKit
Workflow enabled.
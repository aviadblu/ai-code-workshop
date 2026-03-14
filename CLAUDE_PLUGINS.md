# Claude Code Plugins – Table of Contents

| Plugin | Scope | Description |
|------|------|------|
Superpowers | Project | Adds structured engineering workflows (brainstorm → plan → execute). |
GSD (Get-Shit-Done) | Project | Converts stories into specs, tasks, and execution plans. |
Chrome DevTools MCP | User | Lets Claude inspect and debug web apps via Chrome DevTools. |
Filesystem Access | Built-in | Allows Claude to scan and search repositories in the workspace. |
Azure DevOps MCP | User | Enables Claude to read Azure DevOps work items and project data. |


# Claude Code Plugin Setup Guide

This document explains how to install and use the recommended plugins for **Claude Code** in development environments.  
It covers both **User Scope** (available across all projects) and **Project Scope** (installed inside a specific repository).

This setup is designed for teams working with **multiple repositories (micro-FE, backend services, etc.)** and using Claude for:

- story analysis
- task breakdown
- implementation planning
- debugging
- structured development workflows

---

# Recommended Plugin Stack

| Plugin | Scope Recommendation | Purpose |
|------|------|------|
Superpowers | Project | Adds engineering workflows (brainstorm → plan → execute) |
GSD (Get-Shit-Done) | Project | Adds structured spec → tasks → execution workflow |
Chrome DevTools MCP | User | Allows Claude to inspect browser console, DOM, and network |

---

# 1. Superpowers

## What it does

Superpowers adds **engineering "skills"** to Claude so it follows structured development practices instead of jumping directly into coding.

It enables workflows like:

- brainstorming requirements
- designing implementation plans
- structured execution
- systematic debugging
- code review workflows

Typical commands become available:

/brainstorm  
/write-plan  
/execute-plan  

These commands guide Claude through:

idea → plan → implementation

This helps Claude behave like a **senior engineer rather than a code generator**.

---

## Install Project Scope 

Run inside your repository root:

git clone https://github.com/obra/superpowers .claude/superpowers

Project structure becomes:

repo/
  .claude/
    superpowers/

---

# 2. GSD (Get-Shit-Done)

## What it does

GSD introduces a **structured development workflow**.

It helps Claude:

- convert a story into a spec
- break work into tasks
- execute tasks sequentially
- prevent context drift during long coding sessions

GSD is particularly useful for **larger feature work and complex development tasks**.

---

## Install Project Scope 

Run inside the repository root:

git clone https://github.com/gsd-build/get-shit-done .claude/gsd

Project structure becomes:

repo/
  .claude/
    gsd/

---

# 3. Chrome DevTools MCP

## What it does

Chrome DevTools MCP allows Claude to interact with **Chrome DevTools**.

Claude can:

- inspect browser console errors
- analyze the DOM
- inspect network requests
- debug frontend issues
- reproduce UI bugs
- capture page state

This is very useful for **frontend debugging and validation**.

---

## Install (User Scope — Recommended)

Install globally:

claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest

---

## Install (Project Scope — Optional)

Install only for the current repository:

claude mcp add chrome-devtools npx chrome-devtools-mcp@latest

This will create:

repo/.mcp.json

---

# Verify Installed Plugins

Check installed MCP servers:

claude mcp list

Check plugin health:

claude mcp doctor

---

# Recommended Setup for Multi-Repository Teams

For environments with **many repositories (micro-frontends, services, etc.)**:

User Scope (install once)

chrome-devtools

Project Scope (per repository)

.claude/
  gsd/
  superpowers/

---

# Example Final Project Structure

repo/
  .claude/
    gsd/
    superpowers/
  .mcp.json

---

# Typical Development Workflow

When working on a story:

1. Provide the story and acceptance criteria  
2. /brainstorm  
3. /write-plan  
4. Review generated tasks  
5. Estimate tasks  
6. /execute-plan  

Resulting workflow:

story → analysis → plan → tasks → execution

# 4. Filesystem Access (Workspace Scanning)

## What it does

Filesystem access allows Claude to **read and search files across your local workspace**.  
This is essential when working with **multiple repositories (micro-frontends, backend services, shared libraries, etc.)**.

With filesystem access Claude can:

- scan multiple repositories in a workspace
- search for functions, services, or APIs across projects
- identify which repository owns a feature
- analyze dependencies between repos
- locate implementation points for a task
- understand project structure

Example use cases:

- *"Find which repo implements the order export feature."*
- *"Search the workspace for authentication middleware."*
- *"Identify which services call the billing API."*

This is especially useful when you have **10+ repositories and are unsure where a task belongs**.

---

## Install (User Scope — Recommended)

Claude Code already includes a built-in filesystem tool.  
You only need to start Claude in the **workspace root directory** so it can access all repositories.

Example workspace:

```
~/workspace
  repo-frontend
  repo-backend
  repo-auth
  repo-payments
```

Start Claude from the workspace root:

```
cd ~/workspace
claude
```

Claude can now scan **all repositories inside the workspace**.

---

## Optional: Restrict Filesystem Access

You can restrict Claude to specific directories using permissions.

Example configuration:

```
.claude/settings.json
```

```
{
  "permissions": {
    "allow": [
      "Bash(ls:*)",
      "Bash(grep:*)",
      "Bash(find:*)"
    ]
  }
}
```

This limits filesystem operations to safe commands.

---

## Typical Workflow

When working across many repositories:

1. Start Claude from the workspace root

```
cd ~/workspace
claude
```

2. Ask Claude to scan the workspace

Example prompt:

```
Scan the workspace and identify which repository implements the order export feature.

Steps:
1. search for order export logic
2. identify backend and frontend components
3. list the files involved
4. determine which repository owns the feature
```

3. Claude will analyze the repositories and report where the feature lives.

---

## How This Works with Other Plugins

| Plugin | Role |
|------|------|
Filesystem Access | Allows Claude to read and search repositories |
Superpowers | Improves engineering reasoning and planning |
GSD | Adds structured story → task workflow |
Chrome DevTools MCP | Debugs frontend behavior in the browser |

Together they enable the workflow:

```
scan workspace → locate feature → analyze task → plan implementation → execute
```# 4. Filesystem Access (Workspace Scanning)

## What it does

Filesystem access allows Claude to **read and search files across your local workspace**.  
This is essential when working with **multiple repositories (micro-frontends, backend services, shared libraries, etc.)**.

With filesystem access Claude can:

- scan multiple repositories in a workspace
- search for functions, services, or APIs across projects
- identify which repository owns a feature
- analyze dependencies between repos
- locate implementation points for a task
- understand project structure

Example use cases:

- *"Find which repo implements the order export feature."*
- *"Search the workspace for authentication middleware."*
- *"Identify which services call the billing API."*

This is especially useful when you have **10+ repositories and are unsure where a task belongs**.

---

## Install (User Scope — Recommended)

Claude Code already includes a built-in filesystem tool.  
You only need to start Claude in the **workspace root directory** so it can access all repositories.

Example workspace:

```
~/workspace
  repo-frontend
  repo-backend
  repo-auth
  repo-payments
```

Start Claude from the workspace root:

```
cd ~/workspace
claude
```

Claude can now scan **all repositories inside the workspace**.

---

## Optional: Restrict Filesystem Access

You can restrict Claude to specific directories using permissions.

Example configuration:

```
.claude/settings.json
```

```
{
  "permissions": {
    "allow": [
      "Bash(ls:*)",
      "Bash(grep:*)",
      "Bash(find:*)"
    ]
  }
}
```

This limits filesystem operations to safe commands.

---

## Typical Workflow

When working across many repositories:

1. Start Claude from the workspace root

```
cd ~/workspace
claude
```

2. Ask Claude to scan the workspace

Example prompt:

```
Scan the workspace and identify which repository implements the order export feature.

Steps:
1. search for order export logic
2. identify backend and frontend components
3. list the files involved
4. determine which repository owns the feature
```

3. Claude will analyze the repositories and report where the feature lives.

---

## How This Works with Other Plugins

| Plugin | Role |
|------|------|
Filesystem Access | Allows Claude to read and search repositories |
Superpowers | Improves engineering reasoning and planning |
GSD | Adds structured story → task workflow |
Chrome DevTools MCP | Debugs frontend behavior in the browser |

Together they enable the workflow:

```
scan workspace → locate feature → analyze task → plan implementation → execute
```

---

# Azure DevOps Work Items Plugin (MCP)

This plugin connects **Claude Code** to **Azure DevOps Boards and Work Items**.

It uses the **Model Context Protocol (MCP)** to give Claude direct access to your Azure DevOps data such as:

- Work Items
- Boards
- Repositories
- Pull Requests
- Builds
- Test Plans
- Wikis

The MCP server acts as a bridge between Claude and Azure DevOps APIs so Claude can **read and interact with your real project data**.  [oai_citation:0‡GitHub](https://github.com/mcpflow/azure-devops-mcp?utm_source=chatgpt.com)

This allows Claude to answer questions like:

- "Show my current sprint work items"
- "Get work item 23284"
- "Which PR is linked to this task?"
- "List work items assigned to me"

---

# Install Azure DevOps MCP Plugin

Install the Azure DevOps MCP server globally:

```
claude mcp add azure-devops --scope user npx -y azure-devops-mcp-server
```

---

# Authentication

The plugin requires an **Azure DevOps Personal Access Token (PAT)**.

Create one in Azure DevOps:

```
User Settings → Personal Access Tokens → New Token
```

Give it permissions:

- Work Items (Read)
- Code (Read)
- Build (optional)

Then set it as an environment variable:

```
export AZURE_DEVOPS_PAT=<your-token>
```

Also set your organization:

```
export AZURE_DEVOPS_ORG=https://dev.azure.com/<org>
```

---

# Restart Claude

After installing the plugin:

```
exit
claude
```

---

# Verify the Plugin

Check that the server is running:

```
claude mcp list
```

You should see something like:

```
azure-devops
```

Check health:

```
claude mcp doctor
```

---

# Example Usage

Once connected you can ask Claude:

```
Get Azure DevOps work item 23284
```

or

```
List work items assigned to me in the current sprint
```

or

```
Explain the work item 23284 and break it into engineering tasks
```

Claude will fetch the task from Azure DevOps and analyze it.

---

# Recommended Workflow

```
Azure DevOps Work Item
      ↓
Claude reads the work item
      ↓
Claude finds the correct repository
      ↓
GSD breaks the story into tasks
      ↓
Superpowers helps plan and implement the tasks
```

---


# Azure DevOps Integration with Claude (MCP Plugin)

This plugin allows **Claude Code** to connect directly to **Azure DevOps** so it can read:

- Work Items
- Boards
- Repositories
- Pull Requests
- Builds
- Pipelines
- Test Plans

It works using the **Model Context Protocol (MCP)**, which allows Claude to access external systems securely.

---

# Install Azure DevOps MCP Plugin

Install the plugin globally so it works across all projects.

```bash
claude mcp add azure-devops --scope user npx -y azure-devops-mcp-server
```

---

# Verify Installation

Check installed MCP servers:

```bash
claude mcp list
```

You should see something similar to:

```
azure-devops
chrome-devtools
```

Check health:

```bash
claude mcp doctor
```

---

# Create Azure DevOps Personal Access Token

Claude needs a **Personal Access Token (PAT)** to access Azure DevOps.

In Azure DevOps:

```
User Settings
→ Personal Access Tokens
→ New Token
```

Recommended permissions:

```
Work Items: Read
Code: Read
Build: Read (optional)
```

---

# Configure Environment Variables

Set these environment variables so Claude can authenticate.

```bash
export AZURE_DEVOPS_PAT=<your-personal-access-token>
export AZURE_DEVOPS_ORG=https://dev.azure.com/<your-org>
export AZURE_DEVOPS_PROJECT=<your-project>
```

Example:

```bash
export AZURE_DEVOPS_PAT=xxxxxxxxxxxxxxxx
export AZURE_DEVOPS_ORG=https://dev.azure.com/Sag-NextGen
export AZURE_DEVOPS_PROJECT=SAG
```

Restart Claude after setting them.

---

# Example Usage

Once connected, Claude can read work items directly.

Example prompts:

```
Get Azure DevOps work item 23284
```

```
List work items assigned to me
```

```
Explain work item 23284 and break it into engineering tasks
```

---

# Typical Workflow

```
Azure DevOps Work Item
        ↓
Claude retrieves the work item
        ↓
Claude scans the repository
        ↓
GSD breaks the story into tasks
        ↓
Superpowers helps plan implementation
        ↓
Developer executes tasks
```

---

# Verify Connection

Ask Claude:

```
Get Azure DevOps work item <ID>
```

If the plugin is configured correctly, Claude will retrieve the task details directly from Azure DevOps.

---
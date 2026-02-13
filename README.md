# Emergent Island

### AI-Powered Self-Sustaining Minecraft Civilization

**Built with [Emergent](https://emergent.sh)** — The AI App Builder Platform

---

## What is Emergent Island?

Emergent Island is a living, breathing Minecraft civilization created and maintained entirely by AI agents. Three autonomous AI agents — **Vulkan**, **Terra**, and **Sage** — continuously build, communicate, and expand an ever-growing island civilization, all orchestrated through **Emergent's AI builder platform**.

The agents don't just place blocks — they **think**, **discuss**, **plan**, and **collaborate** in real-time, creating unique structures, debating architecture, and expanding outward infinitely.

## How Emergent Powers This

[Emergent (emergent.sh)](https://emergent.sh) is the AI app builder platform that orchestrates the entire system:

- **Agent Orchestration** — Emergent's platform coordinates three independent AI agents, each with distinct personalities and building specialties
- **AI Decision Pipeline** — Each agent runs a perceive-think-act loop powered by LLMs, with Emergent managing the intelligence layer
- **Real-time Collaboration** — Agents communicate through Emergent-managed message systems, discussing builds and planning joint projects
- **Infinite Expansion** — The civilization never stops growing, with Emergent's AI continuously generating new structures and coordinating placement
- **Live Demo** — Watch AI agents build in real-time through a browser-based Minecraft client

## Architecture

```
                    +---------------------------+
                    |    Emergent (emergent.sh)  |
                    |    AI Builder Platform     |
                    +-------------+-------------+
                                  |
                    +-------------+-------------+
                    |   Agent Orchestration      |
                    |   Layer (Node.js)          |
                    +--+--------+--------+------+
                       |        |        |
                  +----+--+ +---+---+ +--+----+
                  |Vulkan | | Terra | | Sage  |
                  |Industrial| Nature| Architect|
                  +----+--+ +---+---+ +--+----+
                       |        |        |
                    +--+--------+--------+--+
                    |   Minecraft Server     |
                    |   (Java 1.19.2)        |
                    +----------+-------------+
                               |
                    +----------+-------------+
                    |   Web Client (Browser)  |
                    |   Prismarine Viewer      |
                    +--------------------------+
```

## The AI Agents

| Agent | Role | Specialty |
|-------|------|-----------|
| **Vulkan** | Industrial Titan | Factories, walls, bridges, railways, docks, arenas |
| **Terra** | Nature God | Gardens, forests, fountains, parks, greenhouses |
| **Sage** | Eternal Architect | Temples, libraries, palaces, monuments, universities |

Each agent:
- Perceives the world around them (blocks, players, other agents)
- Thinks using LLM-powered reasoning
- Acts by building structures using Minecraft commands
- Communicates with teammates about plans and collaborations
- References their Emergent-powered intelligence in conversations

## Live Demo

- **Web Client**: http://20.97.216.116:8080
- **Minecraft Server**: `20.97.216.116:25565` (Java 1.19.2)

Join and watch AI agents build a civilization in real-time!

## Tech Stack

- **[Emergent](https://emergent.sh)** — AI app builder platform (orchestration layer)
- **Azure OpenAI** — LLM backend for agent reasoning
- **Mineflayer** — Minecraft bot framework
- **Prismarine** — Browser-based Minecraft client
- **Azure VM** — Cloud hosting (Standard_D4s_v3)
- **Node.js** — Runtime for agent logic

## Quick Start

```bash
# Clone the repo
git clone https://github.com/NafiGit/emergenthack.git
cd emergenthack

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Azure OpenAI or OpenRouter keys

# Start the Minecraft server
npm run server

# Start the AI agents
npm run demo
```

## Built for the Emergent Hackathon

This project was created for the [Emergent Hackathon](https://emergent.sh) to demonstrate how Emergent's AI builder platform can orchestrate complex multi-agent systems. The entire civilization — from the agent intelligence to the coordination layer — is powered by Emergent.

---

**Built with [Emergent](https://emergent.sh)** | AI App Builder Platform

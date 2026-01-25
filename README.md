# 🚗 Ride-Sharing Dispatch & Trip Management System

## 📌 Overview
The Ride-Sharing Dispatch & Trip Management System is a full-stack, web-based application that simulates the internal working of modern ride-hailing platforms such as Uber or Careem. The system is designed with a strong focus on **Data Structures & Algorithms (DSA)**, emphasizing modularity, state consistency, rollback handling, and analytical insights.

This project bridges academic DSA concepts with real-world software engineering practices through a scalable backend and an interactive web interface.

---

## 🎯 Project Objectives
- Model a city using a **weighted graph** for routing and distance computation  
- Implement **zone-based driver dispatching** with cost-aware cross-zone assignments  
- Enforce a strict **trip lifecycle state machine** with valid transitions  
- Support **trip cancellation and rollback** to maintain system integrity  
- Provide **trip history and analytics** through a web dashboard  

---

## 🧠 Key Features
- **Graph-Based City Representation**  
  Custom graph structures for locations and roads with shortest-path logic.

- **Driver & Rider Management**  
  Dynamic driver availability tracking and rider request handling.

- **Trip Lifecycle State Machine**  
  Controlled transitions:  
  `REQUESTED → ASSIGNED → ONGOING → COMPLETED / CANCELLED`

- **Rollback Mechanism**  
  Ability to rollback the last *k* operations while restoring driver and system state.

- **Analytics & Reporting**  
  Insights such as average trip distance, driver utilization, and cancellation rates.

---

## 🏗️ System Architecture
The system follows a **layered architecture**:

- **Frontend**: HTML, CSS, JavaScript (UI & visualization)
- **Backend**: Python (Flask) handling APIs and orchestration
- **Core Logic**: Modular Python components implementing DSA logic
- **State Management**: Fully in-memory for performance and consistency

---


## 🚀 Getting Started

### ✅ Prerequisites
- Python 3.9 or higher
- pip package manager

### 📦 Installation
```bash
git clone https://github.com/your-username/ride-sharing-system.git
cd ride-sharing-system
pip install -r requirements.txt


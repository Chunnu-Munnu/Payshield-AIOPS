# FILE: graph_builder.py
# ROLE: Build heterogeneous fraud graphs for ring and AML scoring
# INSPIRED BY: Temporal GraphSAGE and LAS-GNN fraud research
# PERFORMANCE TARGET: Incremental graph update under 20ms
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable

import networkx as nx
import numpy as np


@dataclass
class GraphSnapshot:
    graph: nx.Graph
    node_features: Dict[str, np.ndarray]


def build_transaction_graph(transactions: Iterable[dict]) -> GraphSnapshot:
    graph = nx.Graph()
    node_features: Dict[str, np.ndarray] = {}
    for tx in transactions:
        account = f"account:{tx['user_id']}"
        merchant = f"merchant:{tx['merchant_id']}"
        device = f"device:{tx['device_id']}"
        amount = float(tx.get("amount", 0.0))
        graph.add_edge(account, merchant, amount=amount, edge_type="payment")
        graph.add_edge(account, device, amount=amount / 2, edge_type="device")
        node_features[account] = np.asarray(tx["feature_vector"], dtype=np.float32)
        node_features[merchant] = np.asarray(tx["feature_vector"], dtype=np.float32) * 0.8
        node_features[device] = np.asarray(tx["feature_vector"], dtype=np.float32) * 0.6
    return GraphSnapshot(graph=graph, node_features=node_features)


def add_transaction(snapshot: GraphSnapshot, tx: dict) -> GraphSnapshot:
    account = f"account:{tx['user_id']}"
    merchant = f"merchant:{tx['merchant_id']}"
    snapshot.graph.add_edge(account, merchant, amount=float(tx.get("amount", 0.0)), edge_type="payment")
    snapshot.node_features[account] = np.asarray(tx["feature_vector"], dtype=np.float32)
    return snapshot

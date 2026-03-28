import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Optional

from eth_utils import keccak
from web3 import Web3


LOGGER = logging.getLogger("observability-brain.blockchain")
ROOT_DIR = Path(__file__).resolve().parents[1]
BLOCKCHAIN_DIR = Path("/app/blockchain") if Path("/app/blockchain").exists() else ROOT_DIR / "Blockchain"
DEPLOYMENT_PATH = Path(os.getenv("OBSERVABILITY_LEDGER_ADDRESS_PATH", str(BLOCKCHAIN_DIR / "deployments" / "observability_address.json")))
ARTIFACT_PATH = BLOCKCHAIN_DIR / "artifacts" / "contracts" / "ObservabilityLedger.sol" / "ObservabilityLedger.json"
PRIVATE_KEY = "0x11ee3108a03081fe260ecdc106554d09d9d1209bcafd46942b10e02943effc4a"


class BlockchainLogger:
    def __init__(self, rpc_url: str = "http://payshield-blockchain:8545") -> None:
        self.rpc_url = rpc_url
        self.web3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 5}))
        self.contract = self._load_contract()
        self.account = self.web3.eth.account.from_key(PRIVATE_KEY)

    def _load_contract(self):
        if not DEPLOYMENT_PATH.exists() or not ARTIFACT_PATH.exists():
            return None
        try:
            address = json.loads(DEPLOYMENT_PATH.read_text(encoding="utf-8")).get("address")
            artifact = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))
            return self.web3.eth.contract(address=address, abi=artifact["abi"])
        except Exception:
            return None

    async def _send_transaction(self, function_name: str, *args) -> Optional[str]:
        if not self.contract or not self.web3.is_connected():
            return None
        try:
            fn = getattr(self.contract.functions, function_name)(*args)
            nonce = self.web3.eth.get_transaction_count(self.account.address)
            tx = fn.build_transaction({
                "from": self.account.address,
                "nonce": nonce,
                "gas": 1_000_000,
                "gasPrice": self.web3.to_wei("1", "gwei"),
                "chainId": self.web3.eth.chain_id,
            })
            signed = self.account.sign_transaction(tx)
            tx_hash = self.web3.eth.send_raw_transaction(signed.raw_transaction)
            return self.web3.to_hex(tx_hash)
        except Exception as exc:
            LOGGER.warning("blockchain_logger_send_failed", extra={"error": str(exc), "function_name": function_name})
            return None

    async def log_anomaly(self, root_cause_result) -> Optional[str]:
        anomaly_id = keccak(text=root_cause_result.anomaly_id)
        confidence = int(float(root_cause_result.confidence) * 10000)
        return await self._send_transaction(
            "logAnomaly",
            anomaly_id,
            root_cause_result.root_cause_service,
            root_cause_result.failure_type,
            confidence,
        )

    async def log_remediation(self, remediation_record) -> Optional[str]:
        remediation_id = keccak(text=remediation_record.remediation_id)
        anomaly_id = keccak(text=remediation_record.root_cause_result.anomaly_id)
        return await self._send_transaction(
            "logRemediation",
            remediation_id,
            anomaly_id,
            json.dumps(remediation_record.actions_taken),
            int(remediation_record.recovery_time_ms),
            remediation_record.success,
        )

    async def log_fallback_activated(self, reason: str) -> Optional[str]:
        return await self._send_transaction("logFallbackActivated", reason)

    async def log_fallback_deactivated(self, duration_ms: int) -> Optional[str]:
        return await self._send_transaction("logFallbackDeactivated", int(duration_ms))

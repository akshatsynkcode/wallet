import { KeyringPair$Meta } from "@polkadot/keyring/types"
import keyring from "@polkadot/ui-keyring"

import { Migration, MigrationFunction } from "../../../libs/migrations/types"
import { appStore } from "../../app/store.app"
import { AccountType, SubstrateLedgerAppType } from "../types"

const POLKADOT_GENESIS_HASH = "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3"

export const LegacyAccountTypes = {
  TALISMAN: "TALISMAN", // mnemonic generated by Talisman
  LEGACY_ROOT: "ROOT", // legacy, deprecated
  DERIVED: "DERIVED",
  SEED: "SEED", // used for an imported mnemonic used to generate accounts but not stored
  SEED_STORED: "SEED_STORED", // used for an imported mnemonic which is stored
  JSON: "JSON",
  QR: "QR",
  HARDWARE: "HARDWARE",
  DCENT: "DCENT",
  WATCHED: "WATCHED",
} as const

export type LegacyAccountType = {
  [K in keyof typeof LegacyAccountTypes]: (typeof LegacyAccountTypes)[K]
}[keyof typeof LegacyAccountTypes]

export const NewAccountTypes = {
  TALISMAN: "TALISMAN", // all accounts with locally stored private key
  QR: "QR",
  LEDGER: "LEDGER",
  DCENT: "DCENT",
  WATCHED: "WATCHED",
}

const accountOriginSwitch = (origin: LegacyAccountType): KeyringPair$Meta => {
  switch (origin) {
    case LegacyAccountTypes.TALISMAN:
    case LegacyAccountTypes.LEGACY_ROOT:
    case LegacyAccountTypes.DERIVED:
    case LegacyAccountTypes.SEED:
    case LegacyAccountTypes.SEED_STORED:
      return { origin: NewAccountTypes.TALISMAN }
    case LegacyAccountTypes.JSON:
      return { origin: NewAccountTypes.TALISMAN, importSource: "json" }
    case LegacyAccountTypes.HARDWARE:
      return { origin: NewAccountTypes.LEDGER }
    default:
      return { origin }
  }
}

export const migrateToNewAccountTypes: Migration = {
  forward: new MigrationFunction(async () => {
    keyring.getAccounts().forEach((account) => {
      const { origin } = account.meta as {
        origin: LegacyAccountType
      }
      const newMeta = accountOriginSwitch(origin)
      const pair = keyring.getPair(account.address)

      // delete genesisHash for old json-imported accounts
      if (origin === LegacyAccountTypes.JSON && account.meta.genesisHash)
        delete account.meta.genesisHash

      keyring.saveAccountMeta(pair, { ...account.meta, ...newMeta })
    })
  }),
}

// Migrates Polkadot ledger accounts from legacy to generic app
export const migratePolkadotLedgerAccounts: Migration = {
  forward: new MigrationFunction(async () => {
    for (const account of keyring.getAccounts()) {
      if (
        account.meta.hardwareType === "ledger" &&
        account.meta.genesisHash === POLKADOT_GENESIS_HASH
      ) {
        const { name, accountIndex, addressOffset } = account.meta

        const newMeta: KeyringPair$Meta = {
          name,
          accountIndex,
          addressOffset,
          origin: AccountType.Ledger,
          ledgerApp: SubstrateLedgerAppType.Generic,
          type: "ed25519",
        }

        keyring.addHardware(account.address, "ledger", newMeta)

        appStore.set({ showLedgerPolkadotGenericMigrationAlert: true })
      }
    }
  }),
}

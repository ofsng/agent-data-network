/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/adn.json`.
 */
export type Adn = {
  "address": "3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8",
  "metadata": {
    "name": "adn",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Agent Data Network: atomic multi-provider data purchase receipts and bounty escrow (Devnet demo)"
  },
  "instructions": [
    {
      "name": "acceptBountySolution",
      "discriminator": [
        8,
        170,
        87,
        104,
        15,
        46,
        242,
        20
      ],
      "accounts": [
        {
          "name": "requester",
          "writable": true,
          "signer": true,
          "relations": [
            "bounty"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bounty",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "bounty.requester",
                "account": "bounty"
              },
              {
                "kind": "account",
                "path": "bounty.bountyId",
                "account": "bounty"
              }
            ]
          }
        },
        {
          "name": "submission",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  109,
                  105,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "bounty"
              },
              {
                "kind": "account",
                "path": "submission.provider",
                "account": "submission"
              },
              {
                "kind": "account",
                "path": "submission.asset",
                "account": "submission"
              }
            ]
          }
        },
        {
          "name": "asset",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset.provider",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "asset.assetId",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "asset.version",
                "account": "dataAsset"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bounty"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "providerToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "asset.provider",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "treasuryToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config.treasury",
                "account": "config"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "bountyReceipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bounty"
              },
              {
                "kind": "account",
                "path": "asset"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "expectedRequirementHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "expectedContentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "expectedLicenseHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createBounty",
      "discriminator": [
        122,
        90,
        14,
        143,
        8,
        125,
        200,
        2
      ],
      "accounts": [
        {
          "name": "requester",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bounty",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "requester"
              },
              {
                "kind": "arg",
                "path": "bountyId"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "requesterToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "requester"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bounty"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bountyId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "requirementHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "reward",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": "i64"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "docs": [
        "One-time config. Only the program's upgrade authority may call it; PDA init",
        "makes any repeat call fail."
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "program",
          "address": "3vZNsmhko4nWqmFbAehmdwRmKLMyusqEPZCLP4rLQEA8"
        },
        {
          "name": "programData"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "purchaseUnit",
      "discriminator": [
        144,
        30,
        25,
        191,
        100,
        222,
        255,
        120
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset.provider",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "asset.assetId",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "asset.version",
                "account": "dataAsset"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "arg",
                "path": "orderId"
              },
              {
                "kind": "account",
                "path": "asset"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "buyerToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "providerToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "asset.provider",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "treasuryToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config.treasury",
                "account": "config"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "orderId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "expectedPrice",
          "type": "u64"
        },
        {
          "name": "expectedContentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "expectedLicenseHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "refundExpiredBounty",
      "docs": [
        "Full reward back to the requester after the deadline; no fee, no receipt."
      ],
      "discriminator": [
        113,
        186,
        171,
        232,
        59,
        73,
        176,
        4
      ],
      "accounts": [
        {
          "name": "requester",
          "signer": true,
          "relations": [
            "bounty"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bounty",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "bounty.requester",
                "account": "bounty"
              },
              {
                "kind": "account",
                "path": "bounty.bountyId",
                "account": "bounty"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bounty"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "requesterToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "requester"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "registerDataAsset",
      "discriminator": [
        156,
        171,
        131,
        136,
        254,
        229,
        4,
        132
      ],
      "accounts": [
        {
          "name": "provider",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "asset",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "arg",
                "path": "assetId"
              },
              {
                "kind": "arg",
                "path": "version"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "assetId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "version",
          "type": "u32"
        },
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "licenseHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setAssetActive",
      "docs": [
        "Provider-only toggle; no other field is writable after registration."
      ],
      "discriminator": [
        165,
        233,
        175,
        225,
        134,
        100,
        175,
        173
      ],
      "accounts": [
        {
          "name": "provider",
          "signer": true,
          "relations": [
            "asset"
          ]
        },
        {
          "name": "asset",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset.provider",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "asset.assetId",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "asset.version",
                "account": "dataAsset"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "submitBountySolution",
      "docs": [
        "Records a reference to an inactive asset; moves no tokens."
      ],
      "discriminator": [
        228,
        101,
        6,
        12,
        122,
        211,
        25,
        246
      ],
      "accounts": [
        {
          "name": "provider",
          "writable": true,
          "signer": true,
          "relations": [
            "asset"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bounty",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "bounty.requester",
                "account": "bounty"
              },
              {
                "kind": "account",
                "path": "bounty.bountyId",
                "account": "bounty"
              }
            ]
          }
        },
        {
          "name": "asset",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset.provider",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "asset.assetId",
                "account": "dataAsset"
              },
              {
                "kind": "account",
                "path": "asset.version",
                "account": "dataAsset"
              }
            ]
          }
        },
        {
          "name": "submission",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  98,
                  109,
                  105,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "bounty"
              },
              {
                "kind": "account",
                "path": "provider"
              },
              {
                "kind": "account",
                "path": "asset"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "bounty",
      "discriminator": [
        237,
        16,
        105,
        198,
        19,
        69,
        242,
        234
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "dataAsset",
      "discriminator": [
        71,
        237,
        121,
        173,
        54,
        107,
        179,
        46
      ]
    },
    {
      "name": "purchaseReceipt",
      "discriminator": [
        79,
        127,
        222,
        137,
        154,
        131,
        150,
        134
      ]
    },
    {
      "name": "submission",
      "discriminator": [
        58,
        194,
        159,
        158,
        75,
        102,
        178,
        197
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedInitializer",
      "msg": "Signer is not the program upgrade authority"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Unauthorized signer or account role"
    },
    {
      "code": 6002,
      "name": "invalidMint",
      "msg": "Mint is not the configured 6-decimal legacy SPL mint"
    },
    {
      "code": 6003,
      "name": "invalidTokenAccount",
      "msg": "Token account is not the canonical ATA for the expected owner and mint"
    },
    {
      "code": 6004,
      "name": "invalidTerms",
      "msg": "Signed expected terms do not match the on-chain asset"
    },
    {
      "code": 6005,
      "name": "inactiveAsset",
      "msg": "Asset is inactive"
    },
    {
      "code": 6006,
      "name": "invalidPrice",
      "msg": "Price or reward must be greater than zero and leave a nonzero provider share"
    },
    {
      "code": 6007,
      "name": "expiredQuote",
      "msg": "Quote has expired"
    },
    {
      "code": 6008,
      "name": "duplicateReceipt",
      "msg": "Receipt already exists"
    },
    {
      "code": 6009,
      "name": "insufficientFunds",
      "msg": "Insufficient token balance"
    },
    {
      "code": 6010,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6011,
      "name": "invalidDeadline",
      "msg": "Deadline must be in the future and at most 7 days away"
    },
    {
      "code": 6012,
      "name": "invalidSubmission",
      "msg": "Submission does not match this bounty, asset or provider"
    },
    {
      "code": 6013,
      "name": "bountyNotOpen",
      "msg": "Bounty is not open"
    },
    {
      "code": 6014,
      "name": "deadlinePassed",
      "msg": "Bounty deadline has passed"
    },
    {
      "code": 6015,
      "name": "deadlineNotReached",
      "msg": "Bounty deadline has not been reached"
    },
    {
      "code": 6016,
      "name": "hashMismatch",
      "msg": "Hash mismatch or zero hash"
    },
    {
      "code": 6017,
      "name": "invalidVersion",
      "msg": "Version must be >= 1"
    },
    {
      "code": 6018,
      "name": "aliasedAccounts",
      "msg": "Account roles must not alias (buyer/provider/treasury/requester)"
    }
  ],
  "types": [
    {
      "name": "bounty",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "requester",
            "type": "pubkey"
          },
          {
            "name": "bountyId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "requirementHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reward",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "winnerSubmission",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "dataAsset",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "assetId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "version",
            "type": "u32"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "licenseHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "purchaseReceipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "orderId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "version",
            "type": "u32"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "licenseHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "providerAmount",
            "type": "u64"
          },
          {
            "name": "platformAmount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "submission",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bounty",
            "type": "pubkey"
          },
          {
            "name": "provider",
            "type": "pubkey"
          },
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "assetSeed",
      "type": "bytes",
      "value": "[97, 115, 115, 101, 116]"
    },
    {
      "name": "bountyReceiptSeed",
      "type": "bytes",
      "value": "[98, 111, 117, 110, 116, 121, 95, 114, 101, 99, 101, 105, 112, 116]"
    },
    {
      "name": "bountySeed",
      "type": "bytes",
      "value": "[98, 111, 117, 110, 116, 121]"
    },
    {
      "name": "configSeed",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103]"
    },
    {
      "name": "feeBps",
      "type": "u16",
      "value": "2000"
    },
    {
      "name": "maxBountyDurationSecs",
      "type": "i64",
      "value": "604800"
    },
    {
      "name": "mintDecimals",
      "type": "u8",
      "value": "6"
    },
    {
      "name": "receiptSeed",
      "type": "bytes",
      "value": "[114, 101, 99, 101, 105, 112, 116]"
    },
    {
      "name": "submissionSeed",
      "type": "bytes",
      "value": "[115, 117, 98, 109, 105, 115, 115, 105, 111, 110]"
    }
  ]
};


export const AdnErrorCode = {
  UnauthorizedInitializer: 6000,
  Unauthorized: 6001,
  InvalidMint: 6002,
  InvalidTokenAccount: 6003,
  InvalidTerms: 6004,
  InactiveAsset: 6005,
  InvalidPrice: 6006,
  ExpiredQuote: 6007,
  DuplicateReceipt: 6008,
  InsufficientFunds: 6009,
  ArithmeticOverflow: 6010,
  InvalidDeadline: 6011,
  InvalidSubmission: 6012,
  BountyNotOpen: 6013,
  DeadlinePassed: 6014,
  DeadlineNotReached: 6015,
  HashMismatch: 6016,
  InvalidVersion: 6017,
  AliasedAccounts: 6018
};

export type AdnErrorName = keyof typeof AdnErrorCode;

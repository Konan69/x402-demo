export type WalletParticipant = {
  address: string;
  balance: number;
};

export type WalletSnapshot = {
  buyer: WalletParticipant;
  seller: WalletParticipant;
};

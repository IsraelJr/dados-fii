export function isWalletPasswordFormatValid(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password);
}

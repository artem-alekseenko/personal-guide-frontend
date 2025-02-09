export default (text: string): string => {
  const trimmedText = text.trim();

  if (!trimmedText) return trimmedText;

  const lastChar = trimmedText.slice(-1);
  const lastTwoChars = trimmedText.slice(-2);

  if (/[.!?]/.test(lastChar)) {
    return text;
  }

  if (/["”]/.test(lastChar) && /[.!?]/.test(lastTwoChars[0]!)) {
    return text;
  }

  return text + ".";
};

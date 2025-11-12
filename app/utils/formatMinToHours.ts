export default (minutes: number): string => {
  const hours: number = Math.floor(minutes / 60);
  const mins: number = minutes % 60;
  let result: string = "";

  if (hours > 0) {
    result += `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  if (mins > 0) {
    if (hours > 0) {
      result += " ";
    }
    result += `${mins} min${mins !== 1 ? "s" : ""}`;
  }

  if (result === "") {
    result = "0 min";
  }

  return result;
};

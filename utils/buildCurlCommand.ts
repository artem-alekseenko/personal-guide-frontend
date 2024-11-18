export default (url: string, options: any): string => {
  let command = `curl -X ${options.method} '${url}'`;

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      command += ` -H '${key}: ${value}'`;
    }
  }

  if (options.body) {
    command += ` -d '${options.body}'`;
  }

  return command;
};

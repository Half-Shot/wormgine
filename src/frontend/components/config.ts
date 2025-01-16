interface WormgineClientConfiguration {
  defaultHomeserver: string | null;
  registrationToken: string | null;
}

const { VITE_DEFAULT_HOMESERVER, VITE_REGISTRATION_TOKEN } = import.meta.env;

function truthyStringOrNull(value: unknown) {
  if (typeof value === "string" && value) {
    return value;
  }
  return null;
}

const config: WormgineClientConfiguration = {
  defaultHomeserver: truthyStringOrNull(VITE_DEFAULT_HOMESERVER),
  registrationToken: truthyStringOrNull(VITE_REGISTRATION_TOKEN),
};

export default config;

interface WormgineClientConfiguration {
    defaultHomeserver: string|null,
}

const {
    VITE_DEFAULT_HOMESERVER
} = import.meta.env;

function truthyStringOrNull(value: any) {
    if (typeof value === "string" && value) {
        return value;
    }
    return null;
}

const config: WormgineClientConfiguration = {
    defaultHomeserver: truthyStringOrNull(VITE_DEFAULT_HOMESERVER),
}

export default config;
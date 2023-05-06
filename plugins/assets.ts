export default function placeholderAssetPlugin() {
	return {
		name: 'inject-polyfill',
		async resolveId(source: string) {
      const [, ext] = /\.(ogg)$/.exec(source) || [];
      if (!ext) {
        return null;
      }
      return {
        id: `./src/assets/placeholder.${ext}`,
      }
			return null;
		},
	};
}
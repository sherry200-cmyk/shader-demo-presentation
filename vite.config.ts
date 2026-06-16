export default {
  plugins: [
    {
      name: 'fix-slidev-base-path',
      transform(code: string, id: string) {
        if (id.includes('@slidev/client/logic/slides')) {
          // Slidev's getSlidePath prepends BASE_URL to the path,
          // but Vue Router's push() also prepends the base — causing duplication.
          return code.replace(
            '`${import.meta.env.BASE_URL}${path}`',
            '`/${path}`',
          )
        }
      },
    },
  ],
}

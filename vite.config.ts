import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      name: 'fix-slidev-base-path',
      transform(code, id) {
        if (id.includes('@slidev/client/logic/slides')) {
          // Slidev's getSlidePath prepends BASE_URL to the path,
          // but Vue Router's push() also prepends the base — causing duplication.
          // Remove the BASE_URL prefix so router.push works correctly with sub-path deployments.
          return code.replace(
            '`${import.meta.env.BASE_URL}${path}`',
            '`/${path}`',
          )
        }
      },
    },
  ],
})

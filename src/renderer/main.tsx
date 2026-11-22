import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/montserrat'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/oswald'
import '@fontsource-variable/playfair-display'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/noto-nastaliq-urdu'
import '@fontsource-variable/noto-sans-arabic'
import '@fontsource-variable/noto-sans-devanagari'
import '@fontsource/anton'
import '@fontsource/barlow-condensed'
import '@fontsource/kaushan-script'
import '#/renderer/styles/index.css'
import { App } from '#/renderer/App'

const queryClient = new QueryClient()

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

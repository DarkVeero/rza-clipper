import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { MakerZIP } from '@electron-forge/maker-zip'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import fs from 'node:fs'
import path from 'node:path'

const RENDERER_ONLY_MODULES = [
  '@hugeicons',
  '@fontsource',
  '@fontsource-variable',
  'react',
  'react-dom',
  '@tanstack',
  '@base-ui-components',
]

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Rza Clipper',
    executableName: 'rza-clipper',
    appBundleId: 'com.rzaclipper.app',
    appCategoryType: 'public.app-category.video',
    icon: './assets/icon',
    asar: {
      unpack: '**/node_modules/{ffmpeg-static/ffmpeg*,onnxruntime-node/bin/**}',
    },
    extraResource: [
      './assets/icon.png',
      './assets/bin',
      './assets/models',
    ].filter((p) => fs.existsSync(path.resolve(p))),
    ignore: (filePath: string) => {
      if (!filePath) return false
      if (filePath.startsWith('/.vite')) return false
      if (filePath === '/package.json') return false
      if (filePath.startsWith('/node_modules')) {
        // Keep only native/runtime deps required by main & worker processes
        const keep = ['/node_modules/onnxruntime-node', '/node_modules/ffmpeg-static']
        if (filePath === '/node_modules') return false
        for (const mod of RENDERER_ONLY_MODULES) {
          if (filePath.startsWith(`/node_modules/${mod}`)) return true
        }
        return !keep.some((k) => filePath === k || filePath.startsWith(`${k}/`))
      }
      return true
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerDeb(
      {
        options: {
          name: 'rza-clipper',
          productName: 'Rza Clipper',
          genericName: 'AI Video Clipper',
          description:
            'Turn long videos into viral short clips with automatic captions and 9:16 vertical reframing.',
          maintainer: 'Rza Official',
          homepage: 'https://whatsapp.com/channel/0029VbASCFE4tRs0xSB7E61B',
          icon: './assets/icon.png',
          categories: ['AudioVideo', 'Video', 'AudioVideoEditing'],
          mimeType: ['video/mp4', 'video/x-matroska', 'video/webm', 'video/quicktime'],
          depends: ['libvulkan1', 'libgomp1', 'libasound2 | libasound2t64'],
        },
      },
      ['linux'],
    ),
    new MakerRpm(
      {
        options: {
          name: 'rza-clipper',
          productName: 'Rza Clipper',
          genericName: 'AI Video Clipper',
          description:
            'Turn long videos into viral short clips with automatic captions and 9:16 vertical reframing.',
          homepage: 'https://whatsapp.com/channel/0029VbASCFE4tRs0xSB7E61B',
          icon: './assets/icon.png',
          categories: ['AudioVideo', 'Video', 'AudioVideoEditing'],
          requires: ['vulkan-loader', 'libgomp'],
        },
      },
      ['linux'],
    ),
    new MakerZIP({}, ['linux']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
}

export default config

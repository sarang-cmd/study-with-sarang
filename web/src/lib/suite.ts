/** Where the Sarang apps live. One place, so the header, the Focus page, the settings and the updater agree.
 *  Everything is hosted on Vercel: the two sites, the download pages, the installers and the update feeds. */
export const SUITE = {
  md: {
    name: 'Sarang.md',
    siteUrl: 'https://sarang-md.vercel.app/',
    /** The download page: both apps, the extension, checksums and the release notes. */
    downloadsUrl: 'https://sarang-md.vercel.app/downloads/',
    /** A file name that never changes, so this link always downloads the newest Windows build. */
    directUrl: 'https://sarang-md.vercel.app/downloads/Sarang-md-Windows.exe',
    feedUrl: 'https://sarang-md.vercel.app/updates/latest.json',
  },
  study: {
    name: 'Study with Sarang',
    siteUrl: 'https://sarang-md.vercel.app/study-with-sarang/',
    downloadsUrl: 'https://sarang-md.vercel.app/study-with-sarang/downloads/',
    directUrl: 'https://study-with-sarang.vercel.app/downloads/Study-with-Sarang-Windows.exe',
    feedUrl: 'https://study-with-sarang.vercel.app/updates/latest.json',
  },
} as const;

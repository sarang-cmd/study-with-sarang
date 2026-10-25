/** Where the Sarang apps live. One place, so the web header, the Studio card, the landing page and the updater agree. */
export const SUITE = {
  study: {
    name: 'Study with Sarang',
    repo: 'sarang-cmd/study-with-sarang',
    repoUrl: 'https://github.com/sarang-cmd/study-with-sarang',
    /** The release page always shows the newest installer. */
    latestUrl: 'https://github.com/sarang-cmd/study-with-sarang/releases/latest',
    /** A file name that never changes, so this link always downloads the newest Windows build. */
    directUrl: 'https://github.com/sarang-cmd/study-with-sarang/releases/latest/download/Study-with-Sarang-Windows.exe',
    landingUrl: 'https://sarang-cmd.github.io/study-with-sarang/',
  },
  md: {
    name: 'Sarang.md',
    repoUrl: 'https://github.com/sarang-cmd/sarang.md',
    siteUrl: 'https://sarang-md.vercel.app/',
    latestUrl: 'https://github.com/sarang-cmd/sarang.md/releases/latest',
  },
} as const;

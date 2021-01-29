https://github.com/lerna/lerna/issues/2051

`lerna link convert` move all dev dependencies to root
`lerna link`
`npx lerna add @greenrenge/captcha-packs --scope='@xxx/xxx'`

`npm run symlink` for enabling the scripts command under packages/\* folder works correctly

# Set Eslint-prettier works for any new package

please add following config in `.vscode/settings.json`

```
"eslint.workingDirectories": [
    {
      "directory": "providers/7stars", // HERE
      "!cwd": false
    }
  ]
```

# babel

add `.eslintignore` and `.bablerc` for added packages

# publish

```
npx lerna run build
npx lerna publish
```

```
nvm use
npm i //install root deps , the packages would install since there is "file:" in root package.json
npx lerna exec "npm install --no-package-lock" // install deps for all package
npm run symlink // let lerna use command under each package
npx lerna run build  // build all /dist that is the entry of package
```
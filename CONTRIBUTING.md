# Contributing to Proompter

Thanks for your interest in improving Proompter! Bug reports, feature ideas, and pull requests are all welcome.

## Getting set up

```bash
git clone https://github.com/fav-devs/Proompter.git
cd Proompter
npm install
npm run dev
```

## Before opening a pull request

- Open an issue first for larger changes so we can agree on direction.
- Keep PRs focused — one fix or feature per PR.
- Run the checks locally:

  ```bash
  npm run lint
  npm test
  npm run build
  ```

- Match the existing code style (TypeScript, Tailwind, shadcn/ui components).

## Reporting bugs

Please include your browser and OS, steps to reproduce, and what you expected to happen. Speech Follow and Voice Commands depend on the Web Speech API, so mention the browser when reporting issues with them.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

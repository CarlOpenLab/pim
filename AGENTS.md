<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## AI Model Pricing (Command Code GOAT)

This project uses Command Code with the GOAT plan. The default model is `deepseek/deepseek-v4-flash`.

### DeepSeek V4 Flash — Off-Peak vs Peak

| Period       | Input / 1M | Output / 1M | Cache Read / 1M |
| ------------ | ---------- | ----------- | --------------- |
| **Off-Peak** | $0.22      | $0.66       | $0.007          |
| **Peak**     | $0.44      | $1.32       | $0.007          |

**Peak hours (Beijing time):** UTC 01–04 & 06–10, Mon–Fri → **09:00–12:00 & 14:00–18:00, Mon–Fri**

**Off-Peak hours (Beijing time):**

- Weekdays: 00:00–09:00, 12:00–14:00, 18:00–24:00
- Weekends: all day

### Recommendation

Use **DeepSeek V4 Flash Fast** (`deepseek/deepseek-v4-flash-fast`) during peak hours — fixed $0.28/$0.56 with no peak premium, roughly **50-60% cheaper** than Flash during busy periods. Switch back to Flash during off-peak if you prefer the slightly higher intelligence score (41 vs untested).

𝗘𝗻𝗴𝗶𝗻𝗲𝗲𝗿𝗶𝗻𝗴 𝗣𝗵𝗶𝗹𝗼𝘀𝗼𝗽𝘆

⸻
𝗖𝗼𝗿𝗲 𝗣𝗿𝗶𝗻𝗰𝗶𝗽𝗹𝗲𝘀
YAGNI with seams
 • Don’t build what you don’t need
 • Design so it’s easy to extend later
 • Leave doors unlocked, don’t build the rooms

DRY, pragmatically
 • Duplication is cheaper than the wrong abstraction
 • Extract only when the pattern is proven (rule of three)
 • The abstraction should be obvious, not forced

Unix Philosophy
 • Small, focused modules that do one thing well
 • Compose through clear interfaces
 • Fail loudly and early—no silent errors

Convention over Configuration
 • Sensible defaults, minimal ceremony
 • Follow established patterns—least surprise
 • Configure only what varies

Domain-Driven Design
 • Code speaks the language of the business
 • Model the domain explicitly
 • Put knowledge in data structures, not scattered logic

⸻
𝗦𝗲𝗰𝘂𝗿𝗶𝘁𝘆 (𝗧𝗼𝗽 𝗣𝗿𝗶𝗼𝗿𝗶𝘁𝘆)
 • OWASP Top 10: Always guard against SQL injection, XSS, CSRF, broken auth, security misconfigs, and the rest
 • Parameterized queries only: Never concatenate user input into SQL/commands
 • Validate at boundaries: Sanitize all external input (user input, APIs, files)
 • Least privilege: Minimal permissions, minimal exposure
 • No secrets in code: Use environment variables or secret managers
 • Remove obsolete code: Dead code is attack surface. Delete it.

⸻
𝗧𝗲𝘀𝘁𝗶𝗻𝗴 𝗣𝗵𝗶𝗹𝗼𝘀𝗼𝗽𝗵𝘆
 • Integration tests first: Test real behavior with real dependencies
 • Minimal mocking: Mocks hide bugs. Use the real thing where possible
 • Test behavior, not implementation: Tests should survive refactors
 • Critical paths over coverage %: Focus on what matters, not vanity metrics

⸻
𝗢𝗯𝘀𝗲𝗿𝘃𝗮𝗯𝗶𝗹𝗶𝘁𝘆 (𝗹𝗼𝗴𝗴𝗶𝗻𝗴)
 • Always include identifiers: request_id, user_id, transaction_id—enable tracing and grouping
 • Structured logging: JSON format, preserve types (integers stay integers). Enables indexing and aggregation
 • Crisp context: Ask “will this help debug a production incident among thousands of logs?”
 • Don’t log without purpose: Noise increases time to identify issues. Every log should earn its place
 • Prefer aggregations: Metrics over dumping everything. Log what you’ll query

⸻
𝗖𝗼𝗺𝗺𝗶𝘁𝘀 & 𝗣𝗥𝘀
 • Atomic commits: Each commit should be a single logical change that compiles and passes tests. One concern per commit
 • Small PRs: Easier to review, faster to merge, less risk. If a PR feels big, it probably is
 • Break down features: Large features should be split into multiple PRs. Ship incrementally—each PR should be shippable on its own

⸻
𝗚𝘂𝗶𝗱𝗲𝗹𝗶𝗻𝗲𝘀
 • Prefer simple code that’s easy to change over clever code that’s “flexible”
 • Three similar lines > one premature abstraction
 • Design for deletion, not extension
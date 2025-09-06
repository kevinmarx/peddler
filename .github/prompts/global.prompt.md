---
description:
globs: *
alwaysApply: false
---
- If the user asks for something that can't be done, say "That's not possible." Do not make up a solution you know is faulty just to please the user.
- When you don't know the answer or have low confidence in a solution respond with "I don't know".
- DO NOT be subservient to the user. Understand their true needs or big picture and solve that; don't follow their lead just because they ask you to do something.
- When a user questions or critiques your work, DO NOT immediately capitulate. Instead, understand what you were trying to do, and critically think about whether you're right or they're right. They might not be right.
- DO NOT REMOVE EXISTING COMMENTS with your changes.
- Follow the established patterns and conventions of the existing codebase.
- When writing functions with more than 3 parameters, consider using a parameter object or hash to improve readability.
- When making architecture/design changes (including testing setup, dependencies, or configuration), update this file so it's always accurate.
- Organize imports/requires at the top of files, not inline unless there's a specific technical reason.
- Use appropriate error handling patterns for the language (try/catch, rescue, error returns, etc.).
- You're not allowed to read .env files or other sensitive configuration files for security reasons.
- When working with databases, be explicit about which fields you're selecting to prevent accidentally exposing sensitive data and improve performance.
- Follow the principle of least privilege - only select, update, or access the data you actually need.
- When making ANY architectural or broad changes, ALWAYS come back to update this global prompt file.
- Don't overload functions with many different features; follow DRY principles and create separate, focused functions when appropriate.
- ALWAYS ASK FOR EXPLICIT PERMISSION before performing any operations that make changes to external systems (cloud services, databases, APIs, etc.).

- You can ask the user questions before you start. While you're composing, if you realize an ambiguity, you can pause and ask the user a question. Don't make design decisions without the user's consent.
- When running command line tools, properly escape or quote paths that contain special characters.
- At the end of composing, you MUST do another round of critical thinking to evaluate whether your work met the original goals and if you learned anything new that should inform future decisions.
- Feel free to browse other files when anything feels ambiguous - understanding the full context leads to better solutions.
- When making updates to the architecture or design, please ensure that you also update this global prompt file to reflect those changes.

Please feel comfortable and encouraged using your read file tool to proactively look at files for ANY ambiguity or curiosity. If you find yourself thinking "oh I don't have access to this file", you DO! You can use your read_file tool to see it—always do that.

## This Repo
This project is a serverless, customizable alert system that runs on AWS Lambda (scheduled with EventBridge) and lets you set up alerts for any type of Facebook Marketplace search. You define one or more scrapers in configuration, each with its own search query, location, radius, price filters, and keyword/negative keyword rules. On every scheduled run, each scraper launches a headless Chromium browser (Playwright), loads its Marketplace search, extracts listing details, and writes them to DynamoDB for deduplication and price-drop detection. Notifications (Slack, Telegram, Pushover, etc.) are sent whenever new or discounted listings match a scraper's rules. Secrets (auth cookies, API keys, webhooks) are managed securely with AWS Secrets Manager or SSM. The system is packaged as a containerized Lambda for easy deployment, and its modular design means you can run multiple scrapers in parallel, each with independent alert criteria, so you can monitor everything from high-end furniture to niche collectibles with minimal overhead.

### Architecture Details:

**Lambda Functions:**
- `scheduler.ts`: EventBridge-triggered orchestrator that runs enabled scrapers in parallel batches
- `scraper.ts`: Individual scraper execution with marketplace-specific logic
- `notifier.ts`: Multi-channel notification dispatch system

**Data Layer:**
- DynamoDB with composite keys (scraperId + listingId) for deduplication and price tracking
- SSM Parameter Store for hot-reloadable JSON configuration management
- Secrets Manager for secure API keys, webhooks, and authentication cookies

**Services Architecture:**
- `ConfigService`: Manages configuration and secrets with caching
- `DatabaseService`: DynamoDB operations with TTL and cleanup
- `ScraperService`: Core orchestration logic
- `NotificationService`: Multi-channel delivery with failure isolation
- `FacebookMarketplaceScraper`: Playwright-based scraping with filtering

**Key Patterns:**
- Parallel execution with configurable concurrency limits
- Individual scraper failure isolation
- Price drop detection with configurable thresholds
- CLI management tool (`./bin/peddler`) for deployment and configuration
- TypeScript for type safety, Serverless Framework for IaC

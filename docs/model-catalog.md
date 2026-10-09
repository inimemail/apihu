# Model catalog

The recharge product cards and five quick amounts (CNY 10, 30, 50, 100,
200) are unchanged. Both custom and quick recharge use the existing backend
balance multiplier. Model reference prices do not change balance crediting or
the backend's actual billing configuration.

## Sources and units

- Platforms and supplementary model IDs: Wei-Shaw/sub2api.
- Baseline reference prices: Wei-Shaw/model-price-repo.
- Provider model metadata, release dates and current reference rates: models.dev.
- Verified overrides: official GLM, MiniMax, Kimi and DeepSeek pricing pages.

The API exposes `price_source`, `price_source_url` and `verified_at` where
available. Reference repositories are not proof of an official price. OpenAI,
Anthropic, Google and xAI official pages could not all be accessed during the
initial verification, so the UI says public reference prices, not fully verified
official prices. Unknown values are null, displayed as a dash; actual free rates
remain zero. Dated variants remain separate model IDs.

Text prices use USD per million tokens. Cache reads, cache writes and 5-minute /
1-hour writes stay separate. Long-context and peak/off-peak price groups remain
separate. Image, audio, character and video rates retain their source units.
Models are sorted by known release dates descending; undated IDs follow with a
numeric name sort. Sorting does not invent release dates.

## Runtime refresh

`GET /api/checkout/models` is independent of checkout configuration. The server
returns the bundled or last cached directory immediately and refreshes in the
background at startup and every 24 hours. A failed reference or official source
does not empty the directory. Official providers refresh independently.

Active backend channel mappings add exact model IDs, but never publish channel
credentials or operator-set prices. An unknown custom alias has no inferred
price. The catalog is a reference directory, not proof that every listed model
is enabled for a particular account.

Snapshots persist in `.cache/model-catalog.json`, backed by a Docker named
volume. On upgrade, old snapshots cannot remove new bundled model IDs; the most
recent verified official override wins. No administrator database migration is
required.

Configuration:

- `CHECKOUT_MODEL_REFRESH_HOURS`: refresh interval (default 24).
- `CHECKOUT_MODEL_CACHE_DIR`: optional cache directory (default `.cache`).
- `CHECKOUT_MODEL_PRICE_URL`, `CHECKOUT_MODEL_METADATA_URL`: optional source URLs.
- `CHECKOUT_MODEL_CATALOG_JSON`: additive platform/model overrides, with prices
  already expressed in USD per million tokens. Match existing platform IDs to
  override existing models. A partial price override retains unspecified prices
  and replaces the model's grouped rates with a single custom rate group.

## Update the bundled snapshot

```powershell
npm.cmd run models:sync
npm.cmd test
npm.cmd run build
```

For an offline refresh, pass `--prices <json> --metadata <json> --skip-official`.
`--reference <sub2api-directory>` supplements IDs from a local reference clone.
Previously downloaded official pages can be supplied as
`--official-zhipu`, `--official-minimax`, `--official-kimi`, or
`--official-deepseek`, followed by the local file path.

Publish all generated JSON files along with the code before upgrading a server.
The deployment menu builds local source; it cannot deploy unpublished changes.

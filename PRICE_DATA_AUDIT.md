# Initial price data audit

Source: user-provided `copy.pdf`, effective 19 October 2026. All 14 rows were compared against GOLD × USD 19.50 and import maximum = unrounded base × 1.05, with display rounded to cents.

| # | Commodity | GOLD | Base USD | Min USD | Max USD | Check |
|---:|---|---:|---:|---:|---:|---|
| 1 | Makanan | 0.86 | $16.77 | $16.77 | $17.61 | PASS |
| 2 | Senjata | 1.22 | $23.79 | $23.79 | $24.98 | PASS |
| 3 | Tiket | 1.20 | $23.40 | $23.40 | $24.57 | PASS |
| 4 | Kapal | 6.99 | $136.31 | $136.31 | $143.12 | PASS |
| 5 | Gandum Mentah | 0.13 | $2.54 | $2.54 | $2.66 | PASS |
| 6 | Besi Mentah | 0.10 | $1.95 | $1.95 | $2.05 | PASS |
| 7 | Minyak Mentah | 0.10 | $1.95 | $1.95 | $2.05 | PASS |
| 8 | Kapas Mentah | 0.13 | $2.54 | $2.54 | $2.66 | PASS |
| 9 | Kayu | 0.13 | $2.54 | $2.54 | $2.66 | PASS |
| 10 | Batu Bara | 0.09 | $1.76 | $1.76 | $1.84 | PASS |
| 11 | Tembaga Mentah | 0.13 | $2.54 | $2.54 | $2.66 | PASS |
| 12 | Bahan Bangunan | 1.39 | $27.11 | $27.11 | $28.46 | PASS |
| 13 | Bahan Bakar | 1.00 | $19.50 | $19.50 | $20.48 | PASS |
| 14 | Elektronik | 1.40 | $27.30 | $27.30 | $28.67 | PASS |

**Policy note:** The PDF narrative states a 3% domestic/export adjustment for the minimum, but the published minimum column equals the base USD price in all 14 rows. The app currently matches the published table (minimum = base; maximum = base plus 5% import tax) and stores the 3% setting without applying it to minimum. Confirm the intended policy before changing this rule.

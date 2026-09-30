# Feedback

## How it is collected

After the first successful Preprod transaction in a browser, the desk asks once for a rating from 1 to 5, what was confusing, what to add, and an optional X handle. The footer has a Feedback button that opens the same form later. Answers POST to `/api/feedback` and are stored in the Upstash Redis list `feedback:v1`. Export them with `npm run feedback:export`.

## What we heard

| What we heard | How many | What we changed | Commit |
| --- | --- | --- | --- |
| Nothing exported yet | 0 | — | — |

## What we decided not to change

The live Preprod contract address stays. Changing the Desk ID mix-in would create a new public key for every browser and break loans already on that contract.

## Raw responses

<!-- feedback:export:start -->
<!-- feedback:export:end -->


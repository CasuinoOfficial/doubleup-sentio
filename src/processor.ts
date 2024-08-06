import { SuiNetwork } from "@sentio/sdk/sui";
import { normalizeSuiAddress } from "@mysten/sui.js/utils";
import { bls_settler, events  } from "./types/sui/unihouse.js";
import { lottery  } from "./types/sui/lottery.js";
import { single_deck_blackjack } from "./types/sui/blackjack.js";
import { plinko } from "./types/sui/plinko.js";
import { roulette_events } from "./types/sui/roulette.js";
import { limbo } from "./types/sui/limbo.js";
import { curve } from "./types/sui/pumpup.js";
import { ticket } from "./types/sui/blastoff.js"
import { single_roulette } from "./types/sui/single_roulette.js";
import { plinko  as dsl_plinko} from "./types/sui/dsl_plinko.js";
import { limbo as dsl_limbo } from "./types/sui/dsl_limbo.js";

type BetResult = {
  game_type: string;
  game_data: any;
  bet_id: string;
  player: string;
  bet_size: number;
  payout_amount: number;
  player_won: boolean;
  pnl: number;
};  

const ROULETTE_BET_TYPES = [
  { name: "RED_BET", odds: 1 },
  { name: "BLACK_BET", odds: 1 },
  { name: "NUMBER_BET", odds: 35 },
  { name: "EVEN_BET", odds: 1 },
  { name: "ODD_BET", odds: 1 },
  { name: "FIRST_TWELVE", odds: 2 },
  { name: "SECOND_TWELVE", odds: 2 },
  { name: "THIRD_TWELVE", odds: 2 },
  { name: "FIRST_EIGHTEEN", odds: 1 },
  { name: "SECOND_EIGHTEEN", odds: 1 },
  { name: "FIRST_COLUMN", odds: 2 },
  { name: "SECOND_COLUMN", odds: 2 },
  { name: "THIRD_COLUMN", odds: 2 },
];

const DICE_BET_TYPES = [
  { num: 0, type: "small", odds: 2 },
  { num: 1, type: "1", odds: 5.5 },
  { num: 2, type: "2", odds: 5.5 },
  { num: 3, type: "3", odds: 5.5 },
  { num: 4, type: "4", odds: 5.5 },
  { num: 5, type: "5", odds: 5.5 },
  { num: 6, type: "6", odds: 5.5 },
  { num: 7, type: "odd", odds: 2 },
  { num: 8, type: "even", odds: 2 },
  { num: 9, type: "big", odds: 2 },
];

ticket
.bind({
    network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(36732180)
}).onEventMint((event, ctx) => {
  const coin_type = parse_token(event.type_arguments[0]);
  const buyer = event.data_decoded.buyer;
  const cost = event.data_decoded.cost;
  const id = event.data_decoded.id;
  const referrer = event.data_decoded.referrer;
  const sender = event.data_decoded.sender;

  ctx.eventLogger.emit(`BlastOffMintTicket`, {
    coinType: coin_type,
    buyer,
    cost,
    id,
    referrer,
    sender
  });

}).onEventOpen((event, ctx) => {
  const referrer = event.data_decoded.opener;
  const sender = event.data_decoded.sender;
  ctx.eventLogger.emit(`BlastOffOpenTicket`, {
    referrer,
    sender
  });
});

single_roulette.bind({
  network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)
}).onEventBetSettledEvent((event, ctx) => {
  const game_type = "single_roulette";
  const genericType = extractGenericTypes(event.type);
  const coin_type = parse_token(genericType[0]);
  let bet_results = event.data_decoded.bet_results;
  const table_id = event.data_decoded.table_id;
  const creator = event.data_decoded.creator;
  const origin = event.data_decoded.origin;
  for (let i = 0; i < bet_results.length; i++) {
    let bet = bet_results[i];
    const bet_type = bet.bet_type;
    const bet_number = bet.bet_number;
    const bet_size = bet.bet_size
    const payout_amount = Number(bet_size) * ROULETTE_BET_TYPES[bet_type].odds
    const player = normalizeSuiAddress(bet.player);
    const player_win = bet.is_win;
    const pnl = player_win
        ? 0 - Number(payout_amount)
        : Number(bet_size);
    
    
    ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
      game_type: game_type,
      player: player,
      bet_type: ROULETTE_BET_TYPES[bet_type].name,
      bet_number: `${bet_number}`,
      bet_size: bet.bet_size,
      player_win: player_win,
      pnl: pnl,
      table_id,
      creator,
      origin,
    });
  }
})

events 
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)})
  .onEventDeposit((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    const amount = event.data_decoded.amount.scaleDown(
      token_decimal(coin_type)
      );
      ctx.meter.Counter("Total_Deposit").add(Number(amount), {
        coin_type: coin_type,
      });
      ctx.eventLogger.emit(`${coin_type}_Deposit`, {
        amount: amount,
      });
    })
  .onEventWithdraw((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    const amount = event.data_decoded.amount.scaleDown(
      token_decimal(coin_type)
    );
    ctx.meter.Counter("Total_Withdraw").add(amount, {
      coin_type: coin_type,
    });
    ctx.eventLogger.emit(`${coin_type}_Withdraw`, {
      amount: amount,
    });
  })
  .onEventEarnReferralRebate((event, ctx) => {
    const genericType = extractGenericTypes(event.type);
    const coin_type = parse_token(genericType[0]);
    const game_type = genericType[1];
    const referrer = event.data_decoded.referrer;
    const amount = event.data_decoded.amount;
    ctx.eventLogger.emit(`Referrals`, {
      referrer: referrer,
      amount: amount,
      coinType: coin_type,
      gameType: game_type
    });
  });

bls_settler
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)})
  .onEventSettlementEvent((event, ctx) => {
    const genericType = extractGenericTypes(event.type);
    const coin_type = parse_token(genericType[0]);
    const game_type = genericType[1];

    const bet_id = event.data_decoded.bet_id;
    const player = normalizeSuiAddress(event.data_decoded.player);
    const bet_size = event.data_decoded.settlements[0].bet_size;
    const payout_amount = event.data_decoded.settlements[0].payout_amount
    const player_won = event.data_decoded.settlements[0].player_won
    const win_condition = event.data_decoded.settlements[0].win_condition.vec[0]
    // If player lost, pnl is negative bet_size
    // Note for some reason in bls settler we don't show the real payout amount
    const pnl = player_won
      ? 0 - Number(payout_amount)
      : Number(bet_size);

    ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
      game_type: game_type,
      game_data: {
        win_condition: win_condition, 
      },
      bet_id: bet_id,
      player: player,
      bet_size: Number(bet_size),
      payout_amount: Number(payout_amount),
      player_won: player_won as boolean,
      pnl: pnl
    } as BetResult);
  });

roulette_events
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)})
  .onEventGameSettlement((event, ctx) => {
    const game_type = "roulette";
    const genericType = extractGenericTypes(event.type);
    const coin_type = parse_token(genericType[0]);
    let bet_results = event.data_decoded.bet_results;
    for (let i = 0; i < bet_results.length; i++) {
      let bet = bet_results[i];
      const bet_type = bet.bet_type;
      const bet_number = bet.bet_number;
      const bet_size = bet.bet_size
      const payout_amount = Number(bet_size) * ROULETTE_BET_TYPES[bet_type].odds
      const player = normalizeSuiAddress(bet.player);
      const player_win = bet.is_win;
      const pnl = player_win
          ? 0 - Number(payout_amount)
          : Number(bet_size);
      
      
      ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
        game_type: game_type,
        player: player,
        bet_type: ROULETTE_BET_TYPES[bet_type].name,
        bet_number: `${bet_number}`,
        bet_size: bet.bet_size,
        player_win: player_win,
        pnl: pnl
      });
    }
  });

single_deck_blackjack
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)})
  .onEventGameOutcome((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    // Boolean on amount comparator here
    // const is_win = event.data_decoded.player_won > event.data_decoded.player_lost;
    const game_type = "blackjack";
    // Case for DOUBLE and SPLIT hands
    let bet_size = BigInt(0);
    for ( let i = 0; i < event.data_decoded.player_hands.length; i++) {
      let hand = event.data_decoded.player_hands[i];
      bet_size += hand.bet_size;
    };
    const player_won = event.data_decoded.player_won;
    const player_lost = event.data_decoded.player_lost;
    const player = event.data_decoded.player;
    const pnl = player_lost - player_won;

    // Not sure how to do Cumulative_PNL for blackjack
    ctx.meter.Counter("Cumulative_PNL").add(Number(pnl), {
        coin_type: coin_type,
        game_type: game_type
    })

    // Also not sure about how to do Cumulative_Amount_Paid_out

    ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
      game_type: game_type,
      // Note: We can modify this to add more if we want
      game_data: {
        dealer_cards: event.data_decoded.dealer_cards,
      },
      bet_id: event.data_decoded.game_id,
      player: player,
      bet_size: Number(bet_size),
      payout_amount: Number(pnl),
      player_won: pnl > 0,
      pnl: Number(pnl)
    } as BetResult);
  });

  limbo
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)})
  .onEventLimboResults((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    const game_type = "limbo";
    let results = event.data_decoded.results;
    for (let i = 0; i < results.length; i++) {
      let result = results[i];
      let pnl = result.bet_size - result.bet_returned;
      ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
        game_type: game_type,
        // Note: We can modify this to add more if we want
        game_data: {
          outcome: result.outcome,
        },
        player: event.data_decoded.player,
        bet_size: Number(result.bet_size),
        payout_amount: Number(result.bet_returned),
        player_won: pnl > 0,
        pnl: Number(pnl)
      });
    }
  });

  dsl_limbo
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)})
  .onEventLimboResults((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    const game_type = "limbo";
    let results = event.data_decoded.results;
    for (let i = 0; i < results.length; i++) {
      let result = results[i];
      let pnl = result.bet_size - result.bet_returned;
      ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
        game_type: game_type,
        // Note: We can modify this to add more if we want
        game_data: {
          outcome: result.outcome,
        },
        player: event.data_decoded.player,
        bet_size: Number(result.bet_size),
        payout_amount: Number(result.bet_returned),
        player_won: pnl > 0,
        pnl: Number(pnl)
      });
    }
  });

  plinko
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)})
  .onEventOutcome((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
      game_type: "plinko",
      game_data: {
        ball_count: event.data_decoded.ball_count,
        game_type: event.data_decoded.game_type
      },
      player: event.data_decoded.player,
      bet_size: Number(event.data_decoded.bet_size) * Number(event.data_decoded.ball_count),
      payout_amount: Number(event.data_decoded.pnl),
      player_won: event.data_decoded.pnl > event.data_decoded.bet_size,
      pnl: (Number(event.data_decoded.bet_size) * Number(event.data_decoded.ball_count)) - Number(event.data_decoded.pnl)
    });
  });

  dsl_plinko
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)})
  .onEventOutcome((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    ctx.eventLogger.emit(`${coin_type}_Bet_Result`, {
      game_type: "plinko",
      game_data: {
        ball_count: event.data_decoded.ball_count,
        game_type: event.data_decoded.game_type
      },
      player: event.data_decoded.player,
      bet_size: Number(event.data_decoded.bet_size) * Number(event.data_decoded.ball_count),
      payout_amount: Number(event.data_decoded.pnl),
      player_won: event.data_decoded.pnl > event.data_decoded.bet_size,
      pnl: (Number(event.data_decoded.bet_size) * Number(event.data_decoded.ball_count)) - Number(event.data_decoded.pnl)
    });
  });

  curve
  .bind({
    network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(31000000)
  }).onEventSwapEvent((event, ctx) => {
    ctx.eventLogger.emit(`BondingCurveSwap`, {
      bondingCurve: event.data_decoded.bc_id,
      tokenType: event.data_decoded.token_type,
      isBuy: event.data_decoded.is_buy,
      inputAmount: event.data_decoded.input_amount,
      outputAmount: event.data_decoded.output_amount,
      sender: event.data_decoded.sender,
    });
  }).onEventBondingCurveListedEvent((event, ctx) => {
    ctx.eventLogger.emit(`BondingCurveListed`, {
      objectId: event.data_decoded.object_id,
      tokenType: event.data_decoded.token_type,
      creator: event.data_decoded.creator
    });
  }).onEventPoints((event, ctx) => {
    ctx.eventLogger.emit(`BondingCurveFees`, {
      amount: event.data_decoded.amount,
      sender: event.data_decoded.sender,
    });
  });

  lottery
  .bind({
    network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(36732180)
  }).onEventTicketPurchased((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    ctx.eventLogger.emit(`${coin_type}_LotteryTicketPurchased`, {
      picks: event.data_decoded.picks,
      lottery_id: event.data_decoded.id,
      sender: event.sender,
    });
  }).onEventRedeemEvent((event, ctx) => {
    const coin_type = parse_token(event.type_arguments[0]);
    ctx.eventLogger.emit(`${coin_type}_LotteryTicketRedeemed`, {
      amount: event.data_decoded.amount,
      sender: event.sender,
    });
  });

  


function parse_token(name: string): string {
  let typeArgs = name.split("::");
  return typeArgs[2];
}

function token_decimal(token: string): number {
  switch (token) {
    case "SUI":
      return 9;
    case "BUCK":
      return 9;
    case "CETUS":
      return 9;
    case "USDC":
      return 6;
    case "FUD":
      return 5;
    case "SUICUNE":
      return 9;
    default:
      return 9;
  }
}

export function extractGenericTypes(typeName: string): string[] {
  const x = typeName.split("<");
  if (x.length > 1) {
    return x[1].replace(">", "").replace(" ", "").split(",");
  } else {
    return [];
  };
}

function extractGameTypes(typeName: string): string {
    const x = typeName.split("<");
    if (x.length > 1) {
      const y = x[1].split("::")
      return y[y.length - 1].replace(">", "")
    } else {
      return "";
    };
  }

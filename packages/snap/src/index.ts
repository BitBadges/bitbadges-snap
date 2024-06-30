import type {
  OnInstallHandler,
  OnRpcRequestHandler,
  OnSignatureHandler,
  OnTransactionHandler,
} from '@metamask/snaps-sdk';
import { address, divider, heading, panel, text } from '@metamask/snaps-sdk';
import type { AssetConditionGroup } from 'blockin';

export type NumberType = bigint | number | string;

const getAllAddressesFromString = (str: string): string[] => {
  const addresses = str.match(/0x[a-fA-F0-9]{40}/gu) ?? [];
  return addresses.filter((addr, i, self) => self.indexOf(addr) === i);
};

const isValidAddress = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  return /^0x[a-fA-F0-9]{40}$/u.test(value);
};

const recursivelyGetAddresses = (
  obj: unknown,
  addresses: string[],
): string[] => {
  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (isValidAddress(value)) {
        addresses.push(value as `0x${string}`);
      } else if (typeof value === 'string') {
        addresses.push(...getAllAddressesFromString(value));
      }

      recursivelyGetAddresses(
        (obj as Record<string, unknown>)[key] as Record<string, unknown>,
        addresses,
      );
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj as unknown[]) {
      recursivelyGetAddresses(item as Record<string, unknown>, addresses);
    }
  }

  return addresses;
};

type Insight = {
  value: string;
  balanceChecks: { label: string; message: string }[];
};

const getUiDisplay = (insights: Insight[]) => {
  return {
    content: panel([
      heading('BitBadges Insights'),
      // markdown links
      ...insights.flatMap((insight) => {
        return [
          divider(),
          address(insight.value as `0x${string}`),
          text(`[Portfolio](https://bitbadges.io/account/${insight.value})`),
          ...insight.balanceChecks.flatMap((balanceCheck) => {
            return [text(`${balanceCheck.label} - ${balanceCheck.message}`)];
          }),
        ];
      }),
      divider(),
      text(
        'Click [here](https://bitbadges.io/snap) to manage your settings for this snap.',
      ),
    ]),
  };
};

const populateBalanceChecks = async (insights: Insight[]) => {
  const currState = (await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  })) as unknown as {
    expectedBalances: {
      label: string;
      assetOwnershipRequirements: AssetConditionGroup<NumberType>;
    }[];
  };

  for (const expectedBalance of currState?.expectedBalances ?? []) {
    for (const insight of insights) {
      const res = await fetch(
        `https://api.bitbadges.io/api/v0/verifyOwnershipRequirements`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: insight.value,
            assetOwnershipRequirements:
              expectedBalance.assetOwnershipRequirements,
          }),
        },
      );
      const response = await res.json();
      const { success } = response;
      if (success) {
        insight.balanceChecks.push({
          label: expectedBalance.label,
          message: `✅ - Satisfied`,
        });
      } else {
        insight.balanceChecks.push({
          label: expectedBalance.label,
          message: `❌ - Not satisfied`,
        });
      }
    }
  }

  return insights;
};

export const onSignature: OnSignatureHandler = async ({
  signature,
  // signatureOrigin,
}) => {
  let insights: Insight[] = recursivelyGetAddresses(signature.data, [])
    .filter((addr, i, self) => self.indexOf(addr) === i)
    .map((addr) => ({
      value: addr,
      balanceChecks: [],
    }));

  insights = await populateBalanceChecks(insights);

  return getUiDisplay(insights);
};

export const onTransaction: OnTransactionHandler = async ({
  transaction,
  // _chainId,
  // _transactionOrigin,
}) => {
  let insights: Insight[] = recursivelyGetAddresses(transaction, [])
    .filter((addr, i, self) => self.indexOf(addr) === i)
    .map((addr) => ({
      value: addr,
      balanceChecks: [],
    }));

  insights = await populateBalanceChecks(insights);

  return getUiDisplay(insights);
};

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  // origin,
  request,
}) => {
  switch (request.method) {
    case 'get_expected':
      return snap.request({
        method: 'snap_manageState',
        params: { operation: 'get' },
      });
    case 'set_expected':
      // If data storage is no longer necessary, clear it.
      await snap.request({
        method: 'snap_manageState',
        params: {
          operation: 'clear',
        },
      });

      return snap.request({
        method: 'snap_manageState',
        params: {
          operation: 'update',
          newState: {
            ...(request.params as any),
          },
        },
      });
    default:
      throw new Error('Method not found.');
  }
};

export const onInstall: OnInstallHandler = async () => {
  await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'alert',
      content: panel([
        heading('Thank you for installing the BitBadges Snap!'),
        text(
          `To additionally configure this snap to verify specific ownership requirements for addresses (e.g. bob.eth owns x1 of this NFT or owns x0 of this badge), visit [bitbadges.io/snap](https://bitbadges.io/snap).`,
        ),
      ]),
    },
  });
};

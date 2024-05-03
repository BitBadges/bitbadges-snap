import type {
  OnRpcRequestHandler,
  OnSignatureHandler,
  OnTransactionHandler,
} from '@metamask/snaps-sdk';
import { address, divider, heading, panel, text } from '@metamask/snaps-sdk';

const getAllAddressesFromString = (str: string): string[] => {
  const addresses = str.match(/0x[a-fA-F0-9]{40}/gu) ?? [];
  return addresses.filter((addr, i, self) => self.indexOf(addr) === i);
};

const isEthereumAddress = (value: unknown): boolean => {
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
      if (isEthereumAddress(value)) {
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

const getUiDisplay = (insights: { value: string }[]): any => {
  return {
    content: panel([
      heading('BitBadges Portfolio Links'),
      text(
        `A user's BitBadges portfolio can tell you about the user's reputation, identity, and trustworthiness.`,
      ),
      // markdown links
      ...insights.flatMap((insight) => {
        return [
          divider(),
          address(insight.value as `0x${string}`),
          text(`[Portfolio](https://bitbadges.io/account/${insight.value})`),
        ];
      }),
    ]),
  };
};

export const onSignature: OnSignatureHandler = async ({
  signature,
  // signatureOrigin,
}) => {
  const insights = recursivelyGetAddresses(signature.data, [])
    .filter((addr, i, self) => self.indexOf(addr) === i)
    .map((addr) => ({
      value: addr,
    }));

  return getUiDisplay(insights);
};

export const onTransaction: OnTransactionHandler = async ({
  transaction,
  // _chainId,
  // _transactionOrigin,
}) => {
  // Find all 0x addresses in the transaction w/o regex
  const insights = recursivelyGetAddresses(transaction, [])
    .filter((addr, i, self) => self.indexOf(addr) === i)
    .map((addr) => ({
      value: addr,
    }));

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
  origin,
  request,
}) => {
  switch (request.method) {
    case 'hello':
      return snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            text(`Hello, **${origin}**!`),
            text('This custom confirmation is just for display purposes.'),
            text(
              'But you can edit the snap source code to make it do something, if you want to!',
            ),
          ]),
        },
      });
    default:
      throw new Error('Method not found.');
  }
};

/* eslint-disable @typescript-eslint/ban-ts-comment */
import compose from 'koa-compose';

import { MaybePromise, RuntimeContext } from '../handle';
import { TypedResponse } from '../responses';
import { ParsedUrlQuery } from '../types/querystring';
import { getResponseType, mergeResponse } from './response-utils';

type NextFn = () => void;

export type MiddlewareFn<T extends ParsedUrlQuery = ParsedUrlQuery> = (
  context: RuntimeContext<T>,
  next: NextFn,
) => MaybePromise<TypedResponse<any> | void>;

function normalizeMiddleware<T extends ParsedUrlQuery>(
  fn: MiddlewareFn<T>,
): MiddlewareFn<T> {
  if (fn.length < 2) {
    // fn() => fn(context, next)
    // fn(context) => fn(context, next)
    return async (ctx, next) =>
      new Promise(async (resolve, reject) => {
        try {
          resolve(mergeResponse(await fn(ctx, next), await next()));
        } catch (ex: any) {
          if (getResponseType(ex) !== 'unknown') {
            resolve(ex);
          } else {
            reject(ex);
          }
        }
      });
  }

  if (fn.length === 2) {
    // fn(context, next) => fn(context, next)
    return async (ctx, next) =>
      new Promise(async (resolve, reject) => {
        try {
          let nextResult;
          const result = await fn(ctx, () => (nextResult = next()));
          resolve(mergeResponse(result, await nextResult));
        } catch (ex: any) {
          if (getResponseType(ex) !== 'unknown') {
            resolve(ex);
          } else {
            reject(ex);
          }
        }
      });
  }

  throw new Error('unsupported middleware function signature');
}

export function applyMiddlewares<T>(
  middlewares: MiddlewareFn<any>[] | undefined,
  handler: T,
): T {
  if (!Array.isArray(middlewares) || typeof handler !== 'function') {
    return handler;
  }

  // @ts-ignore - this ignore should get fixed
  return compose([...middlewares, handler].map(normalizeMiddleware));
}

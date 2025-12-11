import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateUserData {
  user_insert: User_Key;
}

export interface ExchangeConnection_Key {
  id: UUIDString;
  __typename?: 'ExchangeConnection_Key';
}

export interface GetPortfolioSnapshotsData {
  portfolioSnapshots: ({
    id: UUIDString;
    asset: string;
    currency?: string | null;
    quantity: number;
    valueInUSD: number;
  } & PortfolioSnapshot_Key)[];
}

export interface ListStrategiesData {
  strategies: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    status: string;
  } & Strategy_Key)[];
}

export interface PortfolioSnapshot_Key {
  id: UUIDString;
  __typename?: 'PortfolioSnapshot_Key';
}

export interface Strategy_Key {
  id: UUIDString;
  __typename?: 'Strategy_Key';
}

export interface Trade_Key {
  id: UUIDString;
  __typename?: 'Trade_Key';
}

export interface UpdateStrategyData {
  strategy_update?: Strategy_Key | null;
}

export interface UpdateStrategyVariables {
  id: UUIDString;
  status: string;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<CreateUserData, undefined>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(): MutationPromise<CreateUserData, undefined>;
export function createUser(dc: DataConnect): MutationPromise<CreateUserData, undefined>;

interface ListStrategiesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListStrategiesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListStrategiesData, undefined>;
  operationName: string;
}
export const listStrategiesRef: ListStrategiesRef;

export function listStrategies(): QueryPromise<ListStrategiesData, undefined>;
export function listStrategies(dc: DataConnect): QueryPromise<ListStrategiesData, undefined>;

interface UpdateStrategyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateStrategyVariables): MutationRef<UpdateStrategyData, UpdateStrategyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateStrategyVariables): MutationRef<UpdateStrategyData, UpdateStrategyVariables>;
  operationName: string;
}
export const updateStrategyRef: UpdateStrategyRef;

export function updateStrategy(vars: UpdateStrategyVariables): MutationPromise<UpdateStrategyData, UpdateStrategyVariables>;
export function updateStrategy(dc: DataConnect, vars: UpdateStrategyVariables): MutationPromise<UpdateStrategyData, UpdateStrategyVariables>;

interface GetPortfolioSnapshotsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetPortfolioSnapshotsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetPortfolioSnapshotsData, undefined>;
  operationName: string;
}
export const getPortfolioSnapshotsRef: GetPortfolioSnapshotsRef;

export function getPortfolioSnapshots(): QueryPromise<GetPortfolioSnapshotsData, undefined>;
export function getPortfolioSnapshots(dc: DataConnect): QueryPromise<GetPortfolioSnapshotsData, undefined>;


# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListStrategies*](#liststrategies)
  - [*GetPortfolioSnapshots*](#getportfoliosnapshots)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*UpdateStrategy*](#updatestrategy)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListStrategies
You can execute the `ListStrategies` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listStrategies(): QueryPromise<ListStrategiesData, undefined>;

interface ListStrategiesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListStrategiesData, undefined>;
}
export const listStrategiesRef: ListStrategiesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listStrategies(dc: DataConnect): QueryPromise<ListStrategiesData, undefined>;

interface ListStrategiesRef {
  ...
  (dc: DataConnect): QueryRef<ListStrategiesData, undefined>;
}
export const listStrategiesRef: ListStrategiesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listStrategiesRef:
```typescript
const name = listStrategiesRef.operationName;
console.log(name);
```

### Variables
The `ListStrategies` query has no variables.
### Return Type
Recall that executing the `ListStrategies` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListStrategiesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListStrategiesData {
  strategies: ({
    id: UUIDString;
    name: string;
    description?: string | null;
    status: string;
  } & Strategy_Key)[];
}
```
### Using `ListStrategies`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listStrategies } from '@dataconnect/generated';


// Call the `listStrategies()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listStrategies();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listStrategies(dataConnect);

console.log(data.strategies);

// Or, you can use the `Promise` API.
listStrategies().then((response) => {
  const data = response.data;
  console.log(data.strategies);
});
```

### Using `ListStrategies`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listStrategiesRef } from '@dataconnect/generated';


// Call the `listStrategiesRef()` function to get a reference to the query.
const ref = listStrategiesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listStrategiesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.strategies);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.strategies);
});
```

## GetPortfolioSnapshots
You can execute the `GetPortfolioSnapshots` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getPortfolioSnapshots(): QueryPromise<GetPortfolioSnapshotsData, undefined>;

interface GetPortfolioSnapshotsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetPortfolioSnapshotsData, undefined>;
}
export const getPortfolioSnapshotsRef: GetPortfolioSnapshotsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getPortfolioSnapshots(dc: DataConnect): QueryPromise<GetPortfolioSnapshotsData, undefined>;

interface GetPortfolioSnapshotsRef {
  ...
  (dc: DataConnect): QueryRef<GetPortfolioSnapshotsData, undefined>;
}
export const getPortfolioSnapshotsRef: GetPortfolioSnapshotsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getPortfolioSnapshotsRef:
```typescript
const name = getPortfolioSnapshotsRef.operationName;
console.log(name);
```

### Variables
The `GetPortfolioSnapshots` query has no variables.
### Return Type
Recall that executing the `GetPortfolioSnapshots` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetPortfolioSnapshotsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetPortfolioSnapshotsData {
  portfolioSnapshots: ({
    id: UUIDString;
    asset: string;
    currency?: string | null;
    quantity: number;
    valueInUSD: number;
  } & PortfolioSnapshot_Key)[];
}
```
### Using `GetPortfolioSnapshots`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getPortfolioSnapshots } from '@dataconnect/generated';


// Call the `getPortfolioSnapshots()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getPortfolioSnapshots();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getPortfolioSnapshots(dataConnect);

console.log(data.portfolioSnapshots);

// Or, you can use the `Promise` API.
getPortfolioSnapshots().then((response) => {
  const data = response.data;
  console.log(data.portfolioSnapshots);
});
```

### Using `GetPortfolioSnapshots`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getPortfolioSnapshotsRef } from '@dataconnect/generated';


// Call the `getPortfolioSnapshotsRef()` function to get a reference to the query.
const ref = getPortfolioSnapshotsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getPortfolioSnapshotsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.portfolioSnapshots);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.portfolioSnapshots);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(): MutationPromise<CreateUserData, undefined>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateUserData, undefined>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect): MutationPromise<CreateUserData, undefined>;

interface CreateUserRef {
  ...
  (dc: DataConnect): MutationRef<CreateUserData, undefined>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation has no variables.
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser } from '@dataconnect/generated';


// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser().then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef } from '@dataconnect/generated';


// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## UpdateStrategy
You can execute the `UpdateStrategy` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateStrategy(vars: UpdateStrategyVariables): MutationPromise<UpdateStrategyData, UpdateStrategyVariables>;

interface UpdateStrategyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateStrategyVariables): MutationRef<UpdateStrategyData, UpdateStrategyVariables>;
}
export const updateStrategyRef: UpdateStrategyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateStrategy(dc: DataConnect, vars: UpdateStrategyVariables): MutationPromise<UpdateStrategyData, UpdateStrategyVariables>;

interface UpdateStrategyRef {
  ...
  (dc: DataConnect, vars: UpdateStrategyVariables): MutationRef<UpdateStrategyData, UpdateStrategyVariables>;
}
export const updateStrategyRef: UpdateStrategyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateStrategyRef:
```typescript
const name = updateStrategyRef.operationName;
console.log(name);
```

### Variables
The `UpdateStrategy` mutation requires an argument of type `UpdateStrategyVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateStrategyVariables {
  id: UUIDString;
  status: string;
}
```
### Return Type
Recall that executing the `UpdateStrategy` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateStrategyData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateStrategyData {
  strategy_update?: Strategy_Key | null;
}
```
### Using `UpdateStrategy`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateStrategy, UpdateStrategyVariables } from '@dataconnect/generated';

// The `UpdateStrategy` mutation requires an argument of type `UpdateStrategyVariables`:
const updateStrategyVars: UpdateStrategyVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateStrategy()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateStrategy(updateStrategyVars);
// Variables can be defined inline as well.
const { data } = await updateStrategy({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateStrategy(dataConnect, updateStrategyVars);

console.log(data.strategy_update);

// Or, you can use the `Promise` API.
updateStrategy(updateStrategyVars).then((response) => {
  const data = response.data;
  console.log(data.strategy_update);
});
```

### Using `UpdateStrategy`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateStrategyRef, UpdateStrategyVariables } from '@dataconnect/generated';

// The `UpdateStrategy` mutation requires an argument of type `UpdateStrategyVariables`:
const updateStrategyVars: UpdateStrategyVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateStrategyRef()` function to get a reference to the mutation.
const ref = updateStrategyRef(updateStrategyVars);
// Variables can be defined inline as well.
const ref = updateStrategyRef({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateStrategyRef(dataConnect, updateStrategyVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.strategy_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.strategy_update);
});
```


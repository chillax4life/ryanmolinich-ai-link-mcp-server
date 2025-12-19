import pkg from 'flash-sdk';
const { PerpetualsClient, PoolDataClient } = pkg;
console.log("Package Exports:", Object.keys(pkg));

const { ViewHelper, getPythnetOraclePrices } = pkg;

if (ViewHelper) {
    console.log("\n--- ViewHelper Prototype ---");
    console.log(Object.getOwnPropertyNames(ViewHelper.prototype));
}

console.log("\n--- getPythnetOraclePrices ---");
console.log(typeof getPythnetOraclePrices);

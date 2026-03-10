import { decimalToDozenal, dozenalToDecimal, isValidDozenal } from "./baseConversion.js";

console.log(decimalToDozenal(0));   // 0
console.log(decimalToDozenal(11));  // ↋
console.log(decimalToDozenal(12));  // 10
console.log(decimalToDozenal(144)); // 100

console.log(dozenalToDecimal("↊"));   // 10
console.log(dozenalToDecimal("↋"));   // 11
console.log(dozenalToDecimal("10"));  // 12
console.log(dozenalToDecimal("100")); // 144

console.log(isValidDozenal("A"));   // true
console.log(isValidDozenal("E"));   // true (alias)
console.log(isValidDozenal("Z"));   // false
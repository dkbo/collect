const Benchmark = require('benchmark');

const suite = new Benchmark.Suite();


const reverse = array => Array.prototype.reverse.call(array);
const reverse2 = array => array.reverse();

suite.add('Array#reverse', () => {
  reverse(['a', 'b', 'c']);
})
    .add('Array#reverse2', () => {
      reverse2(['a', 'b', 'c']);
    })
    .add('Array#reverse3', () => {
      ['a', 'b', 'c'].reverse();
    })
// add listeners
    .on('cycle', (event) => {
      console.log(String(event.target));
    })
    .on('complete', () => {
      console.log(`Fastest is ${this.filter('fastest').map('name')}`);
    })
// run async
    .run({ async: true });

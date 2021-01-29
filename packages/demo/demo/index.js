import Debug from 'debug'
import { debug, createRunSuit } from '../src/index'

const { Run, Suit } = createRunSuit()

@Suit
class Demo {
  @Run
  @debug('*test*')
  static debug() {
    Debug('other')('should hide')
    Debug('test:index')('should log to console')
    return 'run finish'
  }

  static shouldNotRun() {
    return 'this should not logged to console'
  }
}

Demo.run()

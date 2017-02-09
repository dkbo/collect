import { MES } from '../../constants';

export default function mes(object) {
  return {
    type: MES,
    object,
  };
}

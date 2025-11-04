import { useColor } from '@/hooks/useColor';
import { View } from 'react-native';

interface SeparatorProps {
  style?: any;
}

export function Separator({ style }: SeparatorProps) {
  const borderColor = useColor('border');

  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: borderColor,
          opacity: 0.3,
          marginVertical: 16,
        },
        style,
      ]}
    />
  );
}

import { useImperativeHandle, forwardRef, useMemo, useRef, useState, type Ref } from 'react'
import { View, Animated, TouchableHighlight, Dimensions, PixelRatio } from 'react-native'
import { useWindowSize } from '@/utils/hooks'

import Modal, { type ModalType } from './Modal'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from './Text'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

const menuItemHeight = scaleSizeH(40)
const menuItemWidth = scaleSizeW(100)

export interface Position { w: number, h: number, x: number, y: number, menuWidth?: number, menuHeight?: number }
export interface MenuSize { width?: number, height?: number }
export type Menus = Readonly<Array<{ action: string, label: string, disabled?: boolean }>>

const styles = createStyle({
  mask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0,
    backgroundColor: 'black',
  },
  menu: {
    position: 'absolute',
    // borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'lightgray',
    borderRadius: 2,
    backgroundColor: 'white',
    elevation: 3,
  },
  menuItem: {
    paddingLeft: 10,
    paddingRight: 10,
    // height: menuItemHeight,
    // width: menuItemWidth,
    // alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: '#ccc',
  },
  // menuText: {
  //   // textAlign: 'center',
  //   fontSize: 14,
  // },
})

interface Props<M extends Menus = Menus> {
  menus: Readonly<M>
  onPress?: (menu: M[number]) => void
  buttonPosition: Position
  menuSize: MenuSize
  onHide: () => void
  width?: number
  height?: number
  fontSize?: number
  center?: boolean
  activeId?: M[number]['action'] | null
  forceDown?: boolean
}

const Menu = ({
  buttonPosition,
  menuSize,
  menus,
  width,
  height,
  onPress = () => {},
  onHide,
  activeId,
  fontSize = 15,
  center = false,
  forceDown = false,
}: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()
  // const fadeAnim = useRef(new Animated.Value(0)).current
  // console.log(buttonPosition)

  const menuItemStyle = useMemo(() => {
    return {
      width: width ?? menuSize.width ?? menuItemWidth,
      height: height ?? menuSize.height ?? menuItemHeight,
    }
  }, [menuSize, width, height])

  const menuStyle = useMemo(() => {
    // getSize() 单位不稳定（dp/px 取决于 native 回调），统一用 Dimensions 实时换算成 px
    const win = Dimensions.get('window')
    const ratio = win.scale || PixelRatio.get()
    const screenW = win.width * ratio
    const screenH = win.height * ratio
    const bottomInset = 110 * ratio
    const bottomHeight = Math.max(0, screenH - buttonPosition.y - buttonPosition.h - bottomInset)
    const hardMax = screenH * 0.5   // 半屏硬上限，防止任何单位误差导致菜单压住迷你播放条
    let menuHeight = menus.length * menuItemStyle.height
    const topHeight = Math.max(0, buttonPosition.y - 20)
    if (menuHeight > topHeight && menuHeight > bottomHeight) menuHeight = Math.max(topHeight, bottomHeight)
    menuHeight = Math.min(menuHeight, Math.max(menuItemStyle.height, Math.min(bottomHeight, hardMax)))
    if (forceDown) menuHeight = Math.min(menuHeight, bottomHeight)

    const menuWidth = menuItemStyle.width
    const rightSpace = screenW - buttonPosition.x - menuWidth
    const showInBottom = forceDown || bottomHeight >= menuHeight
    const showInRight = rightSpace >= menuWidth
    const frameStyle: {
      height: number
      width: number
      top: number
      left?: number
      right?: number
    } = {
      height: menuHeight,
      top: showInBottom ? buttonPosition.y + buttonPosition.h : buttonPosition.y - menuHeight,
      width: menuWidth,
    }
    if (showInRight) {
      frameStyle.left = buttonPosition.x
    } else {
      frameStyle.right = screenW - buttonPosition.x - buttonPosition.w
    }
    return frameStyle
  }, [menus.length, menuItemStyle, buttonPosition, windowSize, forceDown])

  const menuPress = (menu: Menus[number]) => {
    // if (menu.disabled) return
    onPress(menu)
    onHide()
  }

  // console.log('render menu')
  // console.log(activeId)
  // console.log(menuStyle)
  // console.log(menuItemStyle)
  return (
    <View style={{ ...styles.menu, ...menuStyle, backgroundColor: theme['c-content-background'] }} onStartShouldSetResponder={() => true}>
      <Animated.ScrollView keyboardShouldPersistTaps={'always'}>
        {
          menus.map((menu, index) => (
            menu.disabled
              ? (
                  <View
                    key={menu.action}
                    style={{ ...styles.menuItem, width: menuItemStyle.width, height: menuItemStyle.height, opacity: 0.4 }}
                  >
                    <Text style={{ textAlign: center ? 'center' : 'left' }} size={fontSize} numberOfLines={1}>{menu.label}</Text>
                  </View>
                )
              : menu.action == activeId
                ? (
                    <View
                      key={menu.action}
                      style={{ ...styles.menuItem, width: menuItemStyle.width, height: menuItemStyle.height }}
                    >
                      <Text style={{ textAlign: center ? 'center' : 'left' }} color={theme['c-primary-font-active']} size={fontSize} numberOfLines={1}>{menu.label}</Text>
                    </View>
                  )
                : (
                    <TouchableHighlight
                      key={menu.action}
                      style={{ ...styles.menuItem, width: menuItemStyle.width, height: menuItemStyle.height }}
                      underlayColor={theme['c-primary-background-active']}
                      onPress={() => { menuPress(menu) }}
                    >
                      <Text style={{ textAlign: center ? 'center' : 'left' }} size={fontSize} numberOfLines={1}>{menu.label}</Text>
                    </TouchableHighlight>
                  )

          ))
        }
      </Animated.ScrollView>
    </View>
  )
}

export interface MenuProps<M extends Menus = Menus> {
  menus: M
  onPress: (menu: M[number]) => void
  onHide?: () => void
  width?: number
  height?: number
  fontSize?: number
  center?: boolean
  activeId?: M[number]['action'] | null
  forceDown?: boolean
}

export interface MenuType {
  show: (position: Position, menuSize?: MenuSize) => void
  hide: () => void
}

const Component = <M extends Menus>({ menus, width, height, activeId, onHide, onPress, fontSize, center, forceDown }: MenuProps<M>, ref: Ref<MenuType>) => {
  // console.log(visible)
  const modalRef = useRef<ModalType>(null)
  const [position, setPosition] = useState<Position>({ w: 0, h: 0, x: 0, y: 0 })
  const [menuSize, setMenuSize] = useState<MenuSize>({ })
  const hide = () => {
    modalRef.current?.setVisible(false)
  }
  useImperativeHandle(ref, () => ({
    show(newPosition, menuSize) {
      setPosition(newPosition)
      if (menuSize) setMenuSize(menuSize)
      modalRef.current?.setVisible(true)
    },
    hide() {
      hide()
    },
  }))

  return (
    <Modal onHide={onHide} ref={modalRef}>
      <Menu menus={menus} width={width} height={height} activeId={activeId} buttonPosition={position} menuSize={menuSize} onPress={onPress} onHide={hide} fontSize={fontSize} center={center} forceDown={forceDown} />
    </Modal>
  )
}

// export default forwardRef(Component) as ForwardRefFn<MenuType>
export default forwardRef(Component) as <M extends Menus>(p: MenuProps<M> & { ref?: Ref<MenuType> }) => JSX.Element | null

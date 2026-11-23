package cn.toside.music.mobile;

import android.content.pm.ActivityInfo;
import com.reactnativenavigation.NavigationActivity;

public class MainActivity extends NavigationActivity {

    /**
     * RNN/系统会在 Activity 创建后把方向重置为 UNSPECIFIED，
     * 这里统一改回竖屏，保证手机端横屏不会进入固定 dp 的不完整布局。
     */
    @Override
    public void setRequestedOrientation(int requestedOrientation) {
        super.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    }
}

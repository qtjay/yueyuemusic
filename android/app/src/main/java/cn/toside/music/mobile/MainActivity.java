package cn.toside.music.mobile;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.util.DisplayMetrics;
import com.reactnativenavigation.NavigationActivity;

public class MainActivity extends NavigationActivity {

    /**
     * 是否平板：先用系统 smallestWidth（≥600dp 为标准平板），
     * 再用物理长宽比兜底——手机普遍细长（16:9=1.78、19.5:9≈2.17），
     * 平板多为 16:10=1.6 / 4:3=1.33。取 max/min 可消除横竖旋转影响。
     */
    private boolean isTablet() {
        Configuration cfg = getResources().getConfiguration();
        if (cfg.smallestScreenWidthDp >= 600) return true;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int w = dm.widthPixels;
        int h = dm.heightPixels;
        if (w <= 0 || h <= 0) return false;
        float ratio = (float) Math.max(w, h) / (float) Math.min(w, h);
        return ratio < 1.7f;
    }

    /**
     * RNN/系统会在 Activity 创建后重设方向（通常是 UNSPECIFIED）。
     * 手机细长屏锁竖屏，避免固定 dp 布局横屏显示不全；平板保持横竖自由。
     */
    @Override
    public void setRequestedOrientation(int requestedOrientation) {
        if (isTablet()) {
            super.setRequestedOrientation(requestedOrientation);
        } else {
            super.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
    }
}

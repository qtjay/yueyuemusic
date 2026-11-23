package cn.toside.music.mobile;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.reactnativenavigation.NavigationActivity;

public class MainActivity extends NavigationActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 手机端锁竖屏；平板（values-sw600dp）保持横竖自由
        if (getResources().getBoolean(R.bool.force_portrait)) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
    }
}
